const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function normalizeScope(value) {
  return String(value || '').trim().replace(/－/g, '-').replace(/\s+/g, '').toUpperCase();
}

function validateInviteScope(invite, building, unit) {
  const allowedBuildings = [building.full, building.number, `${building.number}号楼`].map(normalizeScope);
  if (invite.zone && normalizeScope(invite.zone) !== normalizeScope(building.zone)) {
    throw new Error('邀请码与所填区域不匹配');
  }
  if (invite.building && !allowedBuildings.includes(normalizeScope(invite.building))) {
    throw new Error('邀请码与所填楼栋不匹配');
  }
  if (invite.unit && normalizeScope(invite.unit) !== normalizeScope(unit)) {
    throw new Error('邀请码与所填房号不匹配');
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const code = String(event.code || '').trim();
  const nickName = String(event.nickName || '').trim();
  const houseNumber = String(event.houseNumber || '').trim().replace(/－/g, '-').replace(/\s+/g, '');
  if (!code) throw new Error('邀请码不能为空');
  if (!nickName) throw new Error('请填写昵称');
  if (event.privacyAccepted !== true) throw new Error('请先阅读并同意隐私说明');

  const houseMatch = houseNumber.match(/^(阅|朝)-(\d{1,2})-(\d{3,4})$/);
  if (!houseMatch) throw new Error('房号格式应为 阅-1-101 或 朝-12-1201');
  const zone = houseMatch[1];
  const buildingNumber = houseMatch[2];
  const roomNumber = houseMatch[3];
  const building = { zone, number: buildingNumber, full: `${zone}-${buildingNumber}` };
  const unit = roomNumber;

  const userResult = await db.collection('users').where({ _openid: OPENID }).limit(1).get();
  const currentUser = userResult.data[0];
  if (!currentUser) throw new Error('请先登录');
  if (currentUser.banned) throw new Error('账号已被限制');
  if (currentUser.verified) throw new Error('该账号已经完成社区认证');
  if (currentUser.verificationStatus === 'pending') {
    return { user: currentUser, status: 'pending', message: '认证申请正在审核中，请等待管理员处理。' };
  }

  const transaction = await db.startTransaction();
  try {
    const inviteResult = await transaction.collection('invites')
      .where({ code, disabled: _.neq(true) })
      .limit(1)
      .get();
    const invite = inviteResult.data[0];
    if (!invite) throw new Error('邀请码不存在或已停用');

    const now = new Date();
    if (invite.expiresAt && new Date(invite.expiresAt) < now) throw new Error('邀请码已过期');
    if (invite.maxUses && invite.usedCount >= invite.maxUses) throw new Error('邀请码已用完');
    validateInviteScope(invite, building, unit);

    const userInTransaction = await transaction.collection('users').doc(currentUser._id).get();
    if (!userInTransaction.data || userInTransaction.data.verified) throw new Error('该账号已经完成社区认证');
    if (userInTransaction.data.verificationStatus === 'pending') {
      throw new Error('认证申请正在审核中，请勿重复提交');
    }

    const update = {
      verified: false,
      verificationStatus: 'pending',
      verificationRequestedAt: db.serverDate(),
      nickName,
      houseNumber,
      role: 'owner',
      zone,
      building: building.full,
      buildingNumber,
      roomNumber,
      unit,
      privacyAcceptedAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    await transaction.collection('users').doc(currentUser._id).update({ data: update });
    await transaction.collection('invites').doc(invite._id).update({ data: { usedCount: _.inc(1) } });
    await transaction.commit();
    return {
      user: Object.assign({}, currentUser, update),
      status: 'pending',
      message: '认证申请已提交，管理员审核通过后即可发帖和评论。'
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
