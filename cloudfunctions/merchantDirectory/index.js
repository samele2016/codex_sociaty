const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const labels = { design: '设计', construction: '施工', material: '主材辅材', furniture: '家具软装', cleaning: '保洁家政' };

exports.main = async () => {
  const result = await db.collection('merchant_applications')
    .where({ status: 'approved' })
    .orderBy('reviewedAt', 'desc')
    .limit(50)
    .get();
  return {
    merchants: result.data.map((item) => ({
      id: item._id,
      businessName: item.businessName,
      description: item.description,
      serviceScope: item.serviceScope || '',
      priceNotes: item.priceNotes || '',
      caseImages: Array.isArray(item.caseImages) ? item.caseImages.slice(0, 6) : [],
      categories: (item.categories || []).map((key) => labels[key] || key),
      reviewedAt: item.reviewedAt || item.updatedAt || item.createdAt
    }))
  };
};
