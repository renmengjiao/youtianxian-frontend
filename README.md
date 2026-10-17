
  # 华为平板功能界面设计

  This is a code bundle for 华为平板功能界面设计. The original project is available at https://www.figma.com/design/uq9r9L5dSQ7htSRaIRdmLb/%E5%8D%8E%E4%B8%BA%E5%B9%B3%E6%9D%BF%E5%8A%9F%E8%83%BD%E7%95%8C%E9%9D%A2%E8%AE%BE%E8%AE%A1.

  ## DevEco Studio / HarmonyOS 运行

  项目根目录现在同时是一个 HarmonyOS Stage 模型工程。原 React 界面会先构建成完全离线的静态资源，再由 ArkUI `Web` 组件加载，因此页面布局、颜色、间距和交互逻辑保持原样。

  ### 环境要求

  - DevEco Studio 5.0 或更高版本
  - HarmonyOS SDK API 12（`5.0.0(12)`）
  - Node.js 18 或更高版本

  ### 首次运行

  1. 在当前目录执行 `npm install`。
  2. 执行 `npm run build:harmony`，前端会直接构建到 HarmonyOS 的离线资源目录。
  3. 使用 DevEco Studio 打开当前目录，而不是打开上一级目录。
  4. 等待 DevEco Studio 完成项目同步，并按提示配置自动签名。
  5. 选择 HarmonyOS 平板或 2-in-1 模拟器/真机，运行 `entry` 模块。

  当前仓库已包含一份最新构建资源，因此直接用 DevEco Studio 打开后也可以编译运行。以后每次修改 `src` 或 `public` 后，只需重新执行 `npm run build:harmony`。

  ## Web 开发模式

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  