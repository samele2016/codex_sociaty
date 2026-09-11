const categories = [
  { key: 'all', label: '全部' },
  { key: 'idle', label: '闲置' },
  { key: 'skill', label: '技能' },
  { key: 'partner', label: '搭子' },
  { key: 'renovation', label: '装修' },
  { key: 'ad', label: '广告' },
  { key: 'groupbuy', label: '团购' },
  { key: 'chat', label: '闲聊' },
  { key: 'help', label: '求助' }
];

const postStatusText = {
  draft: '草稿',
  pending: '待审核',
  published: '已发布',
  removed: '已下架',
  solved: '已解决',
  expired: '已过期'
};

const reviewRequiredCategories = ['ad', 'groupbuy'];

const deliveryDate = '2027-04-01';

const renovationStages = [
  { key: 'before', label: '交付前' },
  { key: 'design', label: '设计阶段' },
  { key: 'construction', label: '施工阶段' },
  { key: 'soft', label: '软装阶段' }
];

module.exports = {
  categories,
  postStatusText,
  reviewRequiredCategories,
  deliveryDate,
  renovationStages
};
