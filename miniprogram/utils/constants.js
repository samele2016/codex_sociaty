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

module.exports = {
  categories,
  postStatusText,
  reviewRequiredCategories
};
