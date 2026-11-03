import { createFileRoute } from '@tanstack/react-router'
import { Section } from '@/components/common/FormSection'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/guide')({
  staticData: { title: '使用指南与免责声明' },
  component: GuidePage,
})

function GuidePage() {
  return (
    <>
      <PageHeader title="使用指南与免责声明" />

      <Section title="版本与开源归属" className="@lg/section:grid-cols-1">
        <div className="space-y-2.5 rounded-2xl bg-background p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            本个人版由 H-Bole 基于 Anhao 中文版二次开发。原有图库素材作者为ギア（@giaaibusi），CharaDB 作者为たき AI（@taki_auto），中国历代服装来自 Shisei／wquguru，素材许可遵循下方版权说明，应用代码遵循 MIT 许可。
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <a className="underline" href="https://github.com/H-Bole/ai-pose-gallery-zh">个人版源码</a>
            <a className="underline" href="https://github.com/anhao/ai-pose-gallery-zh">Anhao 中文版源码</a>
            <a className="underline" href="https://ai-pose-gallery.anhao.app/">上游中文版站点</a>
            <a className="underline" href="https://github.com/H-Bole/ai-pose-gallery-zh/blob/main/LICENSE">MIT 许可证</a>
          </p>
        </div>
      </Section>

      <Section title="角色合成流程" className="@lg/section:grid-cols-3">
        <div className="rounded-2xl bg-background p-4">
          <Badge>1. 人像</Badge>
          <h3 className="mt-2 text-lg font-semibold">人像颜值库 (1,499)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            挑选五官与发型参考，或在合成台直接上传自定义人像图，锁定角色面部特征。
          </p>
        </div>

        <div className="rounded-2xl bg-background p-4">
          <Badge>2. 服装</Badge>
          <h3 className="mt-2 text-lg font-semibold">服装穿搭库 (3,224)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            按现实／二次元、来源、分类和标签挑选；原有写实服装1,407套、CharaDB二次元440套、新增动漫表现1,320条及中国历代57套。中国服装可切换有效视角，同一套不重复计数；二次元图片按需联网读取，各来源条件独立。
          </p>
        </div>

        <div className="rounded-2xl bg-background p-4">
          <Badge>3. 姿势 + 附图</Badge>
          <h3 className="mt-2 text-lg font-semibold">动作姿势库 (1,439)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            挑选 5 视角 3D 素体白模或深度图（Depth），结合云端 API 或本地 ComfyUI 一键生成角色立绘。
          </p>
        </div>
      </Section>

      <Section title="换样与参考对比" className="@lg/section:grid-cols-1">
        <div className="space-y-2 rounded-2xl bg-background p-4 text-sm leading-relaxed text-muted-foreground">
          <p>每槽“换一个”只替换该槽；默认同类，可选全部。其他素材、参数和手动提示词保留，不会自动生成。无候选时会提示，上传素材不参与随机抽取。</p>
          <p>生成结果、历史与作品的“对比参考”使用当次提交快照，支持并排、滑杆、共同缩放与移动。旧记录无快照时会说明；后来修改搭配不会改变已提交的参考。</p>
          <p>中国历代服装在详情与已选槽切换有效视角，收藏、配方和生成参考均保留该视角。</p>
        </div>
      </Section>

      <Section title="免责声明与合规使用规范（必读）" className="@lg/section:grid-cols-1">
        <div className="space-y-2.5 rounded-2xl bg-background p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">1. 仅供学习与合法艺术创作（严禁违法）：</strong>
            本项目（含网页工作台、本地 ComfyUI 插件与工作流模板）
            <strong className="text-foreground">仅供个人学习、人体结构研究、插画构图参考与技术交流使用</strong>
            。严禁使用本工具生成、制作或传播任何违反法律法规、淫秽色情、暴力违禁内容，严禁未经他人明确授权上传真实人物照片进行换脸或深伪合成（Deepfake）等侵犯他人肖像权、隐私权与名誉权的行为。
          </p>
          <p>
            <strong className="text-foreground">2. NSFW（18+）敏感内容提示：</strong>
            图库中包含部分成人向 3D 素体姿势（全身单人・性感系、双人缠绵）与内衣/性感穿搭参考，旨在服务绘画与动作设计练习。系统默认开启「安全模式 (SFW)」屏蔽上述分类，
            <strong className="text-rose-600 dark:text-rose-400">未满 18 周岁的未成年人严禁关闭安全模式或访问相关内容</strong>。
          </p>
          <p>
            <strong className="text-foreground">3. 隐私保护与使用者责任归属：</strong>
            本工作台为纯前端本地应用，所有 AI 生图请求均由使用者自行配置的云端 API Key 或使用者本机 ComfyUI 环境直接执行，平台不收集、不存储任何用户上传的图片或生成结果。
            <strong className="text-foreground">因使用者违规使用或不当传播所产生的一切法律责任，均由使用者本人独立承担，与本项目及维护者无关。</strong>
          </p>
        </div>
      </Section>

      <Section title="访问统计与隐私" className="@lg/section:grid-cols-1">
        <div className="rounded-2xl bg-background p-4 text-sm leading-relaxed text-muted-foreground">
          Cloudflare Web Analytics 仅用于访问量与页面性能统计，支持 SPA 页面切换，未添加自定义事件。统计不会发送 API Key、提示词、上传参考图或生成内容；生图请求由使用者配置的服务处理，生成历史保存在本机浏览器中。
        </div>
      </Section>

      <Section title="数据来源与版权说明" className="@lg/section:grid-cols-1">
        <div className="space-y-2.5 rounded-2xl bg-background p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">• 原作者版权归属：</strong>
            本仓库原有姿势（<code>ai-pose-gallery.pages.dev</code>、<code>ai-pose-depth-gallery.pages.dev</code>）、现实服装（<code>ai-costume-gallery.pages.dev</code>）、人像（<code>ai-portrait-gallery.pages.dev</code>）参考图与原始元数据源自原作者{' '}
            <strong className="text-foreground">ギア（@giaaibusi）</strong> 公开站点，著作权归原作者所有。本仓库仅为中文本地化翻译整理与前端工程学习存档，不对原始图片主张任何所有权。
          </p>
          <p>
            <strong className="text-foreground">• 二次元服装来源：</strong>
            440 套二次元服装源自 <a className="underline hover:text-foreground" href="https://charadb-2fi.pages.dev/" target="_blank" rel="noopener noreferrer">たき AI · CharaDB</a>（标签与名称遵循 CC0，图片从原站在线加载，仅供学习与生图参考，禁止用于真人/未成年人或将原图二次分发，详见 <a className="underline hover:text-foreground" href="https://github.com/taki-ttt/charadb/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">原作者说明</a>）。
          </p>
          <p>
            <strong className="text-foreground">• 新增动漫表现与中国服装：</strong>
            1,320条动漫表现来自 <a className="underline" href="https://ai-costume-anime-gallery.pages.dev/" target="_blank" rel="noopener noreferrer">ギア动漫服装站</a>，是同款穿搭的动漫表现，图片按需联网读取，不镜像、不套用代码许可。
            中国历代57套、227视角来自 <a className="underline" href="https://github.com/wquguru/shisei" target="_blank" rel="noopener noreferrer">Shisei · wquguru</a>，按发布者 <a className="underline" href="https://github.com/wquguru/shisei/blob/8f61ceab10e45f8d3afd254900903733a0ba76ee/LICENSE-images" target="_blank" rel="noopener noreferrer">CC0 1.0</a> 声明使用；属于AI生成服装参考，不代表专业历史形制考据。
          </p>
          <p>
            <strong className="text-foreground">• 原有素材使用与分发限制：</strong>
            人像库遵循 <strong className="text-emerald-600 dark:text-emerald-400">CC0 1.0 协议</strong>；原有姿势库与现实服装库免费供个人学习与 AI 生图参考使用，
            <strong className="text-foreground">严禁将本图库原始图片打包转售或用于付费分发</strong>。
          </p>
        </div>
      </Section>
    </>
  )
}
