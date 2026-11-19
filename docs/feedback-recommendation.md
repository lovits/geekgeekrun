# 个人岗位内容推荐

## 选择与来源（2026-11-18 核验）

采用 TF-IDF + Rocchio 正负质心的内容推荐变体，独立用 JavaScript 实现，不引入 Python 或训练服务。

- scikit-learn 官方仓库约 68.2k 星：https://github.com/scikit-learn/scikit-learn 。星数属于整个框架，不属于独立的 Rocchio 仓库，也不是本应用效果的证明。
- 官方 NearestCentroid 文档说明，配合 TF-IDF 文本向量时称为 Rocchio classifier：https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestCentroid.html 。本应用采用余弦质心对比，非逐行复制其欧式分类器。
- TF-IDF 定义：https://scikit-learn.org/stable/modules/feature_extraction.html#tfidf-term-weighting 。采用平滑 IDF、sublinear TF 和 L2 归一化。
- 原始反馈思路：https://nlp.stanford.edu/IR-book/html/htmledition/the-rocchio71-algorithm-1.html 。
- 对比过 LightFM：https://github.com/lyst/lightfm （页面约 5.1k 星）。它通过用户/物品交互与特征学习潜在表示；对当前只有一位用户、尚无明确标记的场景，优先采用无需其他用户交互的内容方法。这是本应用的选择，不是通用算法排名。

## 实现边界

训练资料只来自最近最多 100 条明确喜欢/不喜欢；未标记不作为负例，取消标记后重算。每个岗位按 ID 保留当前标记。用岗位名与职责，不用公司名、简历或手写偏好的排除词训练内容向量，避免把某公司的一个岗位反馈推广至整家公司，或把排除词误当偏好。

中文用重叠双字特征，英文用技术词特征；做少量明确同义词统一，如 Golang/Go、智能体/Agent。岗位名重复一次增加标题权重，描述最多参与 12000 字符（总文本再限 14000）。TF = 1 + log(count)，IDF = log((1+N)/(1+df)) + 1，L2 归一化。候选只投影到已标记岗位的词表；未知词不会被误当作已知偏好。

分别对喜欢和不喜欢岗位的单位向量取平均，再归一化为两组质心。使用 Rocchio 类质心方向的余弦对比：

```
affinity = cos(candidate, likedCentroid) - cos(candidate, dislikedCentroid)
adjustment = round(10 * clamp(affinity, -1, 1))
```

缺失某组时该组相似度为 0；两组都没有或没有共同词表时调整为 0。此变体不添加原始查询向量 q0，因为本模块只估计反馈偏好；简历和手写条件仍由大模型独立核对。按同一 TF-IDF 相似度选择最多 3 个正例和 3 个负例用于解释。

内容推荐在本机运行。全局偏好总结仍由当前配置的大模型从明确标记生成。两者同时作为后续匹配的软证据；不是训练云端模型，也不改变 BOSS 推荐。提示词明确禁止把内容相似度当作录取概率或资格证明，禁止模型重复加减 adjustment。模型返回基础分后由程序添加调整；不匹配结论不能被喜欢翻转，原有硬性检查独立保留。

少量反馈的词表覆盖有限，也可能存在多个兴趣方向；这是轻量内容方法的限制。测试验证计算、撤销、正负方向及硬条件保护，不表示已证明真实推荐准确率提升。当前没有实际用户标记时不报告个性化效果。

## 界面与简历

匹配设置与岗位测试分为两个页签；原文、反馈总结、提示词和诊断资料可展开查看。评分示例仅显示最近 5 条，历史记录继续保留并能完整导出。

PDF 导入解析成功后保存一份权限为 0600 的本机原件副本。点击文件名在应用的独立 PDF 预览窗口打开，支持缩放、翻页与窗口调整。编辑简历文本不会改写原始 PDF。PDF 预览窗口禁用 Node，启用隔离与沙箱。

大语言模型设置窗口允许拖动四边调整大小，内容随宽度响应布局。CLI 长路径自动换行，去除固定内容宽度和自动强制窗口尺寸。
