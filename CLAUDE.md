# MindMap AI

AI驱动的知识探索思维导图应用。将线性对话转化为可视化的知识地图。

## 核心概念

### 三层架构
- **展示层**：节点的空间布局、合并、隐藏（可自由操作）
- **问答层**：所有问答的线性记录（不可删除，只能隐藏）
- **对话层**：AI看到的完整上下文（始终包含所有问答）

### 关键原则
1. 节点操作不影响AI context
2. 问答不可删除，只能从展示层隐藏
3. Fork包含完整原地图作为可探索的子结构

## 技术栈

- **框架**: Next.js 14 + App Router + TypeScript
- **思维导图**: ReactFlow
- **状态管理**: Zustand
- **数据库**: Prisma + SQLite
- **样式**: Tailwind CSS
- **AI**: OpenAI API + Anthropic API（双支持）

## 项目结构

```
src/
├── app/
│   ├── api/           # API路由
│   │   ├── chat/      # AI对话
│   │   ├── edges/     # 用户自定义边
│   │   ├── maps/      # 地图CRUD
│   │   └── nodes/     # 节点操作
│   ├── map/[id]/      # 地图详情页
│   └── page.tsx       # 首页
├── components/
│   ├── MindMap/       # 思维导图组件
│   ├── ChatInput/     # 输入框
│   └── QADirectory/   # 问答目录
├── hooks/
│   └── useMapStore.ts # Zustand状态管理
├── lib/
│   ├── ai.ts          # AI调用封装
│   ├── db.ts          # Prisma客户端
│   └── utils.ts       # 工具函数
└── types/
    └── index.ts       # 类型定义
```

## 常用命令

```bash
# 开发
npm run dev

# 数据库
npx prisma studio     # 打开数据库管理界面
npx prisma db push    # 同步schema到数据库
npx prisma generate   # 重新生成Prisma Client

# 类型检查
npm run lint
```

## 数据模型

- **MindMap**: 一个探索地图
- **QA**: 一次问答记录
- **Node**: 问答的展示节点（可合并多个QA）
- **PotentialNode**: AI推荐或Fork来源的待探索节点
- **Edge**: 用户手动连接的节点关系（展示层）

## 开发规范

1. 组件按功能分文件夹放在 `src/components/`
2. API路由放在 `src/app/api/`
3. 类型定义集中在 `src/types/index.ts`
4. 状态管理使用 Zustand，store 放在 `src/hooks/`

## MVP功能清单

- [x] 基础项目结构
- [x] 数据库schema
- [x] 思维导图展示
- [x] AI对话（OpenAI/Claude双支持）
- [x] 节点操作（隐藏/恢复）
- [x] 问答目录
- [x] 节点拖拽位置保存
- [x] 用户自定义边持久化
- [ ] 节点样式自定义
- [ ] 节点合并UI
- [ ] Fork功能（第二阶段）
