import type { BgmInfoBoxItem } from '../types'

/**
 * 制作班底字段（导演 / 音乐 / 动画制作 / 制片人…）——按需求全部不展示。
 * 与后端 STAFF_KEYWORDS 保持一致：后端过滤新快照，这里过滤已存的历史快照。
 */
const STAFF_KEYWORDS = [
  // 导演 / 演出 / 分镜·脚本
  '导演',
  '副导演',
  '监督',
  '監修',
  '演出',
  '分镜',
  'コンテ',
  '絵',
  '脚本',
  '剧本',
  '构成',
  '構成',
  // 作画 / 设定 / 设计
  '作画',
  '作监',
  '原画',
  '动画',
  'アニメ',
  '设定',
  '設定',
  '设计',
  'デザイン',
  '色彩',
  '摄影',
  '撮影',
  '剪辑',
  '编辑',
  '編集',
  // 音乐 / 音响
  '音乐',
  '音楽',
  '音响',
  '音響',
  '录音',
  '録音',
  '整音',
  '音效',
  '配音',
  '声优',
  '演员',
  '出演',
  '主题歌',
  '插入歌',
  '角色歌',
  // 演出效果 / 美术
  '特效',
  'VFX',
  'CG',
  '美术',
  '美術',
  '背景',
  '道具',
  '机械',
  // 制作 / 企划 / 发行方
  '制作',
  '製作',
  '企划',
  '企画',
  '製片',
  '制片',
  'プロデュース',
  '宣传',
  '发行',
  '协力',
  '協力',
]

/** 常用作品属性（越靠前越重要） */
const PRIORITY = [
  '中文名',
  '别名',
  '话数',
  '集数',
  '放送开始',
  '放送结束',
  '放送星期',
  '播放电视台',
  '出版社',
  '作者',
  '原作',
  '连载杂志',
  '发售日',
  '册数',
  '页数',
  'ISBN',
  '平台',
  '开始',
  '结束',
  '分级',
  '官方网站',
  'Copyright',
]

/** 过滤掉制作班底字段，只留作品属性 */
export function filterInfobox(items?: BgmInfoBoxItem[] | null): BgmInfoBoxItem[] {
  if (!items) return []
  return items.filter((x) => !STAFF_KEYWORDS.some((w) => x.key.includes(w)))
}

/** 常用字段排前面，其余保持原顺序靠后 */
export function sortInfobox(items: BgmInfoBoxItem[]): BgmInfoBoxItem[] {
  const rank = (key: string) => {
    const exact = PRIORITY.indexOf(key)
    if (exact !== -1) return exact
    return PRIORITY.some((p) => key.includes(p)) ? 50 : 100
  }
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x.key) - rank(b.x.key) || a.i - b.i)
    .map((v) => v.x)
}
