import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const environmentId = process.env.CLOUDBASE_ENV_ID || 'cloud1-d2g3tkgc73fb08aa8';
const cli = process.env.CLOUDBASE_NPX || 'npx.cmd';
const bundledNpxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');

const indexes = {
  users: [['_openid', { _openid: 1 }], ['verified_role', { verified: 1, role: 1 }], ['lastActiveAt', { lastActiveAt: -1 }]],
  invites: [['code', { code: 1 }], ['expiresAt', { expiresAt: 1 }]],
  posts: [['status_pinned_createdAt', { status: 1, pinned: -1, createdAt: -1 }], ['category_status_createdAt', { category: 1, status: 1, createdAt: -1 }], ['openid_createdAt', { _openid: 1, createdAt: -1 }]],
  comments: [['postId_status_createdAt', { postId: 1, status: 1, createdAt: -1 }]],
  reports: [['status_createdAt', { status: 1, createdAt: -1 }], ['targetType_targetId', { targetType: 1, targetId: 1 }]],
  likes: [['postId_openid', { postId: 1, _openid: 1 }, true]],
  favorites: [['postId_openid', { postId: 1, _openid: 1 }, true]],
  privacy_requests: [['openid_createdAt', { _openid: 1, createdAt: -1 }], ['status_createdAt', { status: 1, createdAt: -1 }]],
  community_topics: [['status_voteCount_createdAt', { status: 1, voteCount: -1, createdAt: -1 }]],
  topic_votes: [['topicId_openid', { topicId: 1, _openid: 1 }, true]],
  ad_events: [['dedupeKey', { dedupeKey: 1 }, true], ['adId_eventType_createdAt', { adId: 1, eventType: 1, createdAt: -1 }]],
  lead_assignments: [['merchantId_createdAt', { merchantId: 1, createdAt: -1 }], ['requestId_merchantId_status', { requestId: 1, merchantId: 1, status: 1 }]],
  merchant_agreements: [['merchantId_updatedAt', { merchantId: 1, updatedAt: -1 }], ['status_updatedAt', { status: 1, updatedAt: -1 }]],
  notifications: [['openid_createdAt', { _openid: 1, createdAt: -1 }], ['openid_read_createdAt', { _openid: 1, read: 1, createdAt: -1 }]]
};

const collections = [
  'users', 'communities', 'invites', 'posts', 'comments', 'reports', 'likes', 'favorites',
  'contact_logs', 'audit_logs', 'delivery_updates', 'delivery_documents', 'renovation_requests',
  'merchant_applications', 'lead_assignments', 'ad_campaigns', 'ad_events', 'revenue_logs',
  'privacy_requests', 'community_topics', 'topic_votes', 'merchant_agreements', 'notifications'
];
const phase = process.argv[2] || 'all';

if (!['all', 'collections', 'indexes'].includes(phase)) {
  throw new Error('Usage: node scripts/provision-cloudbase.mjs [all|collections|indexes]');
}

function execute(command, tableName = 'users') {
  const payload = JSON.stringify([{ TableName: tableName, CommandType: 'COMMAND', Command: JSON.stringify(command) }]);
  const cloudbaseArgs = ['--yes', '--package', '@cloudbase/cli', 'tcb', '-e', environmentId, 'db', 'nosql', 'execute', '--command', payload, '--json'];
  const useBundledNpxCli = !process.env.CLOUDBASE_NPX && existsSync(bundledNpxCli);
  const result = spawnSync(useBundledNpxCli ? process.execPath : cli, useBundledNpxCli ? [bundledNpxCli, ...cloudbaseArgs] : cloudbaseArgs, {
    encoding: 'utf8',
    shell: false
  });

  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function parseJson(output) {
  const start = output.indexOf('{');
  if (start < 0) throw new Error(`CloudBase CLI returned no JSON: ${output}`);
  return JSON.parse(output.slice(start));
}

if (phase === 'all' || phase === 'collections') {
  const listed = execute({ listCollections: 1, cursor: {} });
  if (listed.status !== 0) throw new Error(listed.stderr || listed.stdout);
  const listData = parseJson(listed.stdout);
  const rows = listData.data?.cursor?.firstBatch || listData.data?.results?.flat() || [];
  const existing = new Set(rows.map((item) => item.name));
  console.log(`existing collections: ${existing.size}`);

  for (const collection of collections) {
    if (existing.has(collection)) {
      console.log(`collection exists: ${collection}`);
      continue;
    }
    const created = execute({ create: collection }, collection);
    if (created.status !== 0) throw new Error(`Failed to create ${collection}: ${created.stderr || created.stdout}`);
    console.log(`collection created: ${collection}`);
  }
}

if (phase === 'all' || phase === 'indexes') {
  for (const [collection, definitions] of Object.entries(indexes)) {
    for (const [name, key, unique = false] of definitions) {
      const created = execute({
        createIndexes: collection,
        indexes: [{ name, key, unique }]
      }, collection);
      if (created.status === 0) {
        console.log(`index created: ${collection}.${name}`);
        continue;
      }
      const message = `${created.stdout}\n${created.stderr}`;
      if (/already exists|IndexOptionsConflict|IndexKeySpecsConflict|索引.*存在/i.test(message)) {
        console.log(`index exists: ${collection}.${name}`);
        continue;
      }
      throw new Error(`Failed to create ${collection}.${name}: ${message}`);
    }
  }
}

console.log('CloudBase database provisioning completed.');
