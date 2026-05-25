const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const code = String(event.code || '').trim();
  if (!code) {
    throw new Error('邀请码不能为空');
  }

  const now = new Date();
  const inviteRes = await db.collection('invites').where({ code, disabled: _.neq(true) }).limit(1).get();
  if (!inviteRes.data.length) {
    throw new Error('邀请码不存在或已停用');
  }

  const invite = inviteRes.data[0];
  if (invite.expiresAt && new Date(invite.expiresAt) < now) {
    throw new Error('邀请码已过期');
  }
  if (invite.maxUses && invite.usedCount >= invite.maxUses) {
    throw new Error('邀请码已用完');
  }

  const building = event.building || invite.building || '';
  const unit = event.unit || invite.unit || '';
  const update = {
    verified: true,
    building,
    unit,
    updatedAt: db.serverDate()
  };

  const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get();
  if (!userRes.data.length) {
    throw new Error('请先登录');
  }
  await db.collection('users').doc(userRes.data[0]._id).update({ data: update });
  await db.collection('invites').doc(invite._id).update({ data: { usedCount: _.inc(1) } });

  return {
    user: Object.assign({}, userRes.data[0], update)
  };
};
