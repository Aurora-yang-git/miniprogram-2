/* eslint-disable max-len */

// NOTE:
// This file is a backend-packaged copy of the default decks that used to be seeded into each user's `cards`.
// We now seed them once into `community_decks` as official decks so everyone can browse & collect.

function triple(cn, meaning, example) {
  return `**中文**：${cn}\n**意思**：${meaning}\n**例子**：${example}`.trim()
}

function getOfficialDefaultDecks() {
  const actTags = ['G11 ACT']
  const cspTags = ['AP CSP']
  const chineseTags = ['G11 Chinese']
  const apPsychTags = ['AP Psych']

  const act = {
    deckTitle: '1/8 ACT默写单词',
    tags: actTags,
    cards: [
      { q: 'flippancy', a: '轻率 n.\nA lack of seriousness; treating important matters in a joking or dismissive way.' },
      { q: 'irritate', a: '激怒 v.\nTo annoy; provoke; or cause discomfort.' },
      { q: 'defensive', a: '防御性的 adj.\nProtective in attitude; reacting as if under attack or criticism.' },
      { q: 'torture', a: '折磨 v.\nTo inflict such suffering.' },
      { q: 'get along', a: '相处 phr./v.\nTo have a friendly or workable relationship with someone.' },
      { q: "for heaven's sake", a: '看在上帝的份上 expr.\nUsed to express frustration or emphasis; an exasperated appeal.' },
      { q: 'self-sufficient', a: '自给自足的 adj.\nAble to provide for oneself without outside help; independent.' },
      { q: 'make do with', a: '凑合 phr./v.\nTo manage with what is available; even if it is not ideal.' },
      { q: 'scrub', a: '擦洗 v.\nTo clean something thoroughly by rubbing hard.' },
      { q: 'drape', a: '覆盖 v.\nTo cover or hang loosely in folds over something.' },
      { q: 'recline against', a: '斜靠 phr./v.\nTo lean or lie back in a relaxed position while supported.' },
      { q: 'animated', a: '生机勃勃的 adj.\nFull of life; movement; and energy; lively and expressive.' },
      { q: 'be envious of', a: '嫉妒 adj.\nFeeling jealousy or desire for what someone else has.' },
      { q: 'futile', a: '徒劳的 adj.\nUseless; incapable of producing any result or change.' },
      { q: 'slug', a: '蛞蝓 n.\nA slow-moving creature.' },
      { q: 'in honor of sb', a: '向某人致敬 phr.\nTo show respect or admiration for someone; especially in a ceremony or event.' },
      { q: 'linger on', a: '徘徊 phr./v.\nTo remain for a long time; either physically or in memory.' },
      { q: 'mound up', a: '堆积 phr./v.\nTo pile or heap up into a raised mass.' },
      { q: 'crouch', a: '蹲下 v.\nTo lower the body close to the ground by bending knees and leaning forward.' },
      { q: 'shifting dynamics', a: '动态变化 n. phr.\nChanging patterns of behavior; power; or relationships within a group or situation.' },
      { q: 'diffident', a: '缺乏自信的 adj.\nShy; lacking confidence; and hesitant to assert oneself.' },
      { q: 'resentful', a: '愤恨的 adj.\nFeeling or showing bitterness or anger due to perceived unfair treatment.' },
      { q: 'adoring', a: '崇拜的 adj.\nShowing deep love; admiration; or devotion.' },
      { q: 'attentive', a: '专注的 adj.\nPaying close attention; considerate and aware of others\' needs.' },
      { q: 'tend to', a: '照料 phr./v.\nTo take care of sb/sth.' },
      { q: 'endearing', a: '讨人喜欢的 adj.\nLovable or charming in a way that inspires affection or warmth.' },
      { q: 'sprawled', a: '四肢摊开的 adj.\nLying or spread out with limbs extended in a relaxed or uncontrolled manner.' },
      { q: 'meticulous', a: '一丝不苟的 adj.\nExtremely careful and precise; showing great attention to detail.' },
      { q: 'trample', a: '踩踏 v.\nTo step on or crush something by walking or running over it; to treat without respect.' },

      // Back to the future
      { q: 'patchwork', a: '拼凑物 n.\nSomething made up of many different pieces; a mixture of varied elements.' },
      { q: 'malt', a: '麦芽 n.\nGrain that has been soaked and sprouted; used especially in brewing.' },
      { q: 'barley', a: '大麦 n.\nA cereal grain used for food; animal feed; and brewing.' },
      { q: 'jagged', a: '锯齿状的 adj.\nHaving sharp; uneven edges or points.' },
      { q: 'balmy', a: '温暖的 adj.\nPleasantly warm; mild in climate.' },
      { q: 'swampy', a: '沼泽的 adj.\nWet; muddy; and waterlogged.' },
      { q: 'teem with', a: '充满 phr./v.\nTo be full of or crowded with.' },
      { q: 'flora and fauna', a: '动植物 n. phr.\nPlant and animal life of a particular region.' },
      { q: 'sinuous', a: '蜿蜒的 adj.\nCurving or winding smoothly; like a snake.' },
      { q: 'exceptionally', a: '格外 adv.\nTo an unusually great degree.' },
      { q: 'torrid', a: '炎热的 adj.\nVery hot and dry; scorching.' },
      { q: 'fascinate', a: '使着迷 v.\nTo attract and hold attention; to captivate.' },
      { q: 'sweeping', a: '广泛的 adj.\nExtensive in range or effect; broad and powerful.' },
      { q: 'specialization', a: '专业化 n.\nThe process of focusing on a specific area of knowledge or skill.' },
      { q: 'dawn', a: '黎明 n.\nThe first appearance of light; the beginning of something.' },
      { q: 'vertebrate', a: '脊椎动物 n.\nAn animal with a backbone.' },
      { q: 'oceanographer', a: '海洋学家 n.\nA scientist who studies the ocean and its processes.' },
      { q: 'spike', a: '激增 n.\nA sudden sharp increase or projection.' },
      { q: 'team up with', a: '与...合作 phr./v.\nTo cooperate or work together.' },
      { q: 'glitch', a: '小故障 n.\nA small malfunction or error.' },
      { q: "leave one's calling card on land", a: '留下痕迹 phr.\nTo leave a visible or lasting trace or mark.' },
      { q: 'implausible', a: '难以置信的 adj.\nNot believable; unlikely to be true.' },
      { q: 'segue through', a: '平稳过渡 v.\nTo move smoothly from one topic or section to another.' },
      { q: 'smattering', a: '少量 n.\nA small amount or number.' },
      { q: 'extract', a: '提取 v.\nTo remove or obtain something; often by effort.' },
      { q: 'legume', a: '豆科植物 n.\nA plant with seeds in pods; such as beans or peas.' },
      { q: 'conifer', a: '针叶树 n.\nA cone-bearing evergreen tree; such as pine or fir.' },
      { q: 'distant', a: '遥远的 adj.\nFar away in space; time; or relationship.' },
      { q: 'temperate', a: '温带的 adj.\nRelating to a mild climate; neither very hot nor very cold.' },
      { q: 'shrub', a: '灌木 n.\nA small woody plant; smaller than a tree.' },

      // Unit 14 (with hints)
      {
        q: 'abstain',
        a: "戒绝 v.\nTo stay away from doing something by one's own choice.",
        hint: '`abs`（离开）+ `tain`（保持）→ 保持离开的状态 → **戒绝**。'
      },
      {
        q: 'accommodate',
        a: '容纳；适应 v.\nTo provide for, supply with; to have space for.',
        hint: '`ac` + `com`（一起）+ `mod`（模式）+ `ate` → 能**容纳**多种模式。'
      },
      {
        q: 'allegiance',
        a: '忠诚 n.\nThe loyalty or obligation owed to a government, nation, or cause.',
        hint: '`al` + `legi`（法律）+ `ance` → 对法律的**忠诚**。'
      },
      {
        q: 'amalgamate',
        a: '合并 v.\nTo unite; to combine elements into a unified whole.',
        hint: '`a` + `malgam`（混合物）+ `ate` → 使成混合物 → **合并**。'
      },
      {
        q: 'append',
        a: '附加 v.\nTo attach, add, or tack on as a supplement.',
        hint: '`ap` + `pend`（悬挂）→ 挂在后面 → **附加**。'
      },
      {
        q: 'commemorate',
        a: '纪念 v.\nTo serve as a memorial or reminder of.',
        hint: '`com`（一起）+ `memor`（记忆）+ `ate` → 一起记忆 → **纪念**。'
      },
      {
        q: 'enumerate',
        a: '列举 v.\nTo count; to name one by one, list.',
        hint: '`e`（出）+ `numer`（数字）+ `ate` → 按数字说出 → **列举**。'
      },
      {
        q: 'exalt',
        a: '提拔；赞扬 v.\nTo make high in rank, power, character, or quality.',
        hint: '`ex`（上）+ `alt`（高）→ 提到高处 → **提拔**。'
      },
      {
        q: 'extort',
        a: '勒索 v.\nTo obtain by violence, misuse of authority, or threats.',
        hint: '`ex`（出）+ `tort`（扭曲）→ 用扭曲的手段拿出 → **勒索**。'
      },
      {
        q: 'far-fetched',
        a: '牵强的 adj.\nStrained or improbable.',
        hint: '`far`（远）+ `fetched`（拿来）→ 从很远的地方拿来的理由 → **牵强的**。'
      },
      {
        q: 'glum',
        a: '沮丧的 adj.\nDepressed, gloomy.',
        hint: '谐音“哥们”，哥们失恋了，很**沮丧**。'
      },
      {
        q: 'replica',
        a: '复制品 n.\nA copy, close reproduction.',
        hint: '`re`（再次）+ `plica`（折叠）→ 再次折叠出来的 → **复制品**。'
      },
      {
        q: 'responsive',
        a: '反应灵敏的 adj.\nAnswering or replying; reacting readily.',
        hint: '来自 `respond`（回应）。'
      },
      {
        q: 'sanctuary',
        a: '避难所 n.\nA sacred or holy place; refuge or protection.',
        hint: '`sanct`（神圣）+ `uary` → 神圣的地方 → **避难所**。'
      },
      {
        q: 'self-seeking',
        a: '谋私利的 adj.\nSelfish, unconcerned with the needs of others.',
        hint: '`self`（自己）+ `seeking`（寻找）→ 只为自己寻找利益。'
      },
      {
        q: 'submissive',
        a: '顺从的 adj.\nHumbly obedient; tending to give in to authority.',
        hint: '`sub`（下）+ `miss`（送）→ 在下面听从差遣 → **顺从**。'
      },
      {
        q: 'tally',
        a: '清点；符合 v.\nTo count up; to correspond or agree.',
        hint: '谐音“泰利”，泰利在**清点**货物。'
      },
      {
        q: 'taskmaster',
        a: '工头 n.\nOne whose job it is to assign work to others.',
        hint: '`task`（任务）+ `master`（主人）→ 分配任务的主人。'
      },
      {
        q: 'transform',
        a: '改变 v.\nTo change completely in appearance or form.',
        hint: '`trans`（变）+ `form`（形态）→ **改变**形态。'
      },
      { q: 'upheaval', a: '剧变 n.\nA sudden, violent upward movement; great disorder.' }
    ]
  }

  const csp = {
    deckTitle: 'CSP期中复习卡片',
    tags: cspTags,
    cards: [
      { q: 'Data 是什么？', a: 'Data: A collection of facts.' },
      { q: 'Number base（进制）是什么？', a: 'Number base: the number of digits or digit combinations a system uses to represent values.' },
      { q: '十进制（Base 10）使用哪些数字？', a: '0–9 的组合来表示数值。' },
      { q: '二进制（Base 2）使用哪些数字？', a: '只使用 0 和 1。' },
      { q: '二进制 101 对应十进制是多少？', a: '5（(4 + 1 = 5)）。' },
      { q: 'Bit 是什么？', a: 'Bit (binary digit): the smallest unit of information (0 or 1).' },
      { q: 'Byte 是什么？', a: 'Byte = 8 bits.' },
      { q: '8 bits 一共能表示多少个不同的值？', a: '256 个（0–255），因为 2^8 = 256。' },
      { q: 'n bits 能表示的最大值公式？', a: '最大值：2^n - 1。' },
      { q: 'n bits 能表示的不同取值个数公式？', a: '取值个数：2^n。' },
      { q: 'Analog data vs Digital data 区别？', a: 'Analog：连续测量、平滑变化。\nDigital：离散值，需要格式化。' },
      { q: 'Sampling（采样）是什么？', a: '以离散的时间间隔记录模拟信号，把它转换为数字数据。' },
      { q: 'Data abstraction（数据抽象）是什么？', a: '过滤掉细节、保留必要信息（如只存日期 11/13/2025，而不是每毫秒）。' },
      { q: 'Data compression（数据压缩）是什么？', a: '把数据打包成更小空间，同时能访问原始数据；压缩/解压是两步过程；节省存储与带宽。' },
      { q: 'RLE（Run-Length Encoding）怎么做？', a: '用“重复次数 + 值”替换连续重复数据，如 FFFFFIIIIIIVVVVVVVEEEE → 5F6I7V4E。' },
      { q: 'Lossless vs Lossy 压缩？', a: 'Lossless：不丢数据（ZIP/PNG）。\nLossy：牺牲部分数据换更小体积（JPEG/MP3/MP4）。' },
      { q: 'Internet 是什么？', a: '使用标准、开放协议互联的网络集合。' },
      { q: 'Packet（数据包）由哪两部分组成？', a: 'Header（源/目的地/序号等元数据）+ Data section（实际数据）。' },
      { q: 'Routing（路由）是什么？', a: '为数据包选择传输路径。' },
      { q: '为什么 packet 可能乱序到达？怎么办？', a: '走不同路径/延迟不同导致乱序；用序号重组（reassembly）。' },
      { q: 'Bandwidth 和 Latency 区别？', a: 'Bandwidth：单位时间最大数据量（bps/Mbps）。\nLatency：数据延迟时间（ms）。' },
      { q: 'TCP vs UDP 区别？', a: 'TCP/IP：可靠传输。\nUDP：更快但不保证可靠。' },
      { q: 'IPv4 vs IPv6？', a: 'IPv4：4 组十进制，地址数约 2^32（≈43 亿）。\nIPv6：8 组十六进制，地址数约 2^128。' },
      { q: 'Scalability / Fault tolerance / Redundancy 分别是什么？', a: 'Scalability：可随需求增长。\nFault tolerance：部分失效仍能运行。\nRedundancy：冗余备份组件/路径。' },
      { q: 'Digital divide（数字鸿沟）是什么？', a: '有无技术/网络接入的人群之间的差距。' },
      { q: '6 bits 有多少种不同取值？', a: '64（2^6 = 64）。' },
      { q: '10 bits 最大值是多少？', a: '1023（2^10-1）。' },
      { q: '二进制 1101 转十进制是多少？', a: '13（1·2^3 + 1·2^2 + 0·2^1 + 1·2^0 = 13）。' },
      { q: '温度传感器数据是 analog 还是 digital？', a: 'Analog（连续变化）。' },
      { q: '医学 X 光压缩应选 lossless 还是 lossy？', a: 'Lossless（不能丢关键信息）。' },
      { q: '什么时候更适合用 UDP？', a: '直播/游戏/VoIP 等更在意实时性的场景。' },
      { q: '家里 200 Mbps 但很卡，最可能的问题是？', a: '高 latency（延迟大）而不是带宽不足。' },
      { q: 'Redundancy 为什么能提升 fault tolerance？', a: '提供备份组件/路径，部分故障时可切换继续运行。' },
      { q: 'Digital divide 的常见成因？', a: '人口统计（年龄/教育）、社会经济地位（收入/成本）、地理位置（城乡/基础设施）。' },
      { q: '减少数字鸿沟的方案？', a: '数字素养教育、基础设施投入、设备可获得性、相关政策。' }
    ]
  }

  const finalReview = {
    deckTitle: '期末复习加点字',
    tags: chineseTags,
    cards: [
      { q: '使**负**栋之柱', a: '支撑' },
      { q: '多于在**庾**之粟粒', a: '谷仓' },
      { q: '不敢言**而**敢怒', a: '连词，表转折' },
      { q: '日益**骄固**', a: '骄横顽固' },
      { q: '函谷**举**', a: '被攻占' },
      { q: '**可怜**焦土', a: '可惜' },
      { q: '**族**秦者秦也', a: '灭族' },
      { q: '则**递**三世可至万世而为君', a: '依次传递' },
      { q: '秦人不暇**自哀**', a: '为动用法，为……哀叹，宾语前置（秦人不暇哀自）' },
      { q: '多**于**南亩之农夫', a: '比，状语后置（于南亩之农夫多）' },

      { q: '晋**军**函陵', a: '驻扎' },
      { q: '越国以**鄙**远', a: '把……当做边邑' },
      { q: '焉用亡郑以**陪**邻', a: '增加' },
      { q: '**共**其乏困', a: '同“供”，供给' },
      { q: '又欲**肆**其西封', a: '延伸、扩张' },
      { q: '唯君**图**之', a: '希望' },
      { q: '**微**夫人之力不及此', a: '如果没有' },
      { q: '**因**人之力而敝之', a: '依靠' },
      { q: '因人之力而**敝**之', a: '损害' },
      { q: '失其所**与**', a: '结交、同盟' },
      { q: '宫中**尚**促织之戏', a: '崇尚，喜好' },
      { q: '因**责**常供', a: '责令' },
      { q: '昂其**直**', a: '同“值”，价值' },
      { q: '**居**为奇货', a: '囤积、储存' },
      { q: '**操**童子业', a: '从事' },
      { q: '探石**发**穴', a: '打开' },
      { q: '迄无**济**', a: '成功' },
      { q: '细**疏**其能', a: '分条陈述' },
      { q: '岂**意**其至此哉', a: '料想' },
      { q: '民日**贴**妇卖儿', a: '抵押' },

      { q: '四海**一**', a: '统一' },
      { q: '直**走**咸阳', a: '通达' },
      { q: '廊腰**缦回**', a: '萦绕' },
      { q: '**囷囷焉**', a: '……的样子' },
      { q: '不**霁**何虹', a: '雨后初晴' },
      { q: '**辇**来于秦', a: '名作状，乘辇车' },
      { q: '**缦立**远视', a: '久立' },
      { q: '**剽掠**其人', a: '抢劫、掠夺' },
      { q: '**鼎铛玉石**', a: '把宝鼎看作铁锅' },
      { q: '弃掷**逦迤**', a: '连续不断，这里指到处都是' }
    ]
  }

  const apUnit0 = {
    deckTitle: 'AP Psych｜Unit 0',
    tags: apPsychTags,
    cards: [
      // Perspectives & Bias
      { q: 'Psychodynamic', a: triple('精神动力学观点', '行为受无意识冲突与童年经验影响', '把恐惧解释为被压抑的冲突'), topic: 'Perspectives & Bias' },
      { q: 'Cognitive', a: triple('认知观点', '思维/解释影响情绪与行为', '“我会失败”→焦虑加重'), topic: 'Perspectives & Bias' },
      { q: 'Behavioral', a: triple('行为主义观点', '行为由学习（奖惩/联结）塑造', '狗咬后怕狗＝经典条件作用'), topic: 'Perspectives & Bias' },
      { q: 'Humanistic', a: triple('人本主义观点', '强调自由意志、自我实现', '关注自尊与个人成长'), topic: 'Perspectives & Bias' },
      { q: 'Biological', a: triple('生物学观点', '大脑、激素、基因影响行为', '低血清素与情绪有关'), topic: 'Perspectives & Bias' },
      { q: 'Evolutionary', a: triple('进化观点', '行为是适应性选择的结果', '害怕蛇有生存优势'), topic: 'Perspectives & Bias' },
      { q: 'Sociocultural', a: triple('社会文化观点', '文化与群体规范塑造行为', '不同文化对“礼貌”不同'), topic: 'Perspectives & Bias' },
      { q: 'Biopsychosocial', a: triple('生物-心理-社会模型', '生物+心理+社会共同解释', '抑郁=基因+认知+环境压力'), topic: 'Perspectives & Bias' },
      { q: 'Cultural norms', a: triple('文化规范', '群体共享的行为规则', '上课举手再发言'), topic: 'Perspectives & Bias' },
      { q: 'Confirmation bias', a: triple('确认偏误', '只找支持自己观点的信息', '只看支持自己立场的新闻'), topic: 'Perspectives & Bias' },
      { q: 'Hindsight bias', a: triple('事后诸葛偏误', '事后觉得“我早知道”', '考砸后说“我早觉得会难”'), topic: 'Perspectives & Bias' },
      { q: 'Overconfidence', a: triple('过度自信', '高估自己判断/能力', '没复习也觉得稳过'), topic: 'Perspectives & Bias' },

      // Research Designs
      { q: 'Experimental (incl. Random assignment)', a: triple('实验研究（含随机分配）', '操纵变量+随机分组→看因果', '给一组咖啡因、一组安慰剂'), topic: 'Research Designs' },
      { q: 'Case Study (nonexperimental)', a: triple('个案研究（非实验）', '深入研究单个个体/事件', '研究一位失忆病人'), topic: 'Research Designs' },
      { q: 'Correlation (non-experimental)', a: triple('相关研究（非实验）', '看两变量是否一起变化', '睡眠时间与成绩相关'), topic: 'Research Designs' },
      { q: 'Meta-analysis (non-experimental)', a: triple('元分析（非实验）', '汇总多项研究统计结论', '合并几十篇治疗研究结果'), topic: 'Research Designs' },
      { q: 'Naturalistic Observation', a: triple('自然观察', '不干预，观察自然情境行为', '在食堂观察排队插队行为'), topic: 'Research Designs' },

      // 实验方法要素
      { q: 'Hypothesis', a: triple('假设', '可检验的预测', '“睡眠越多成绩越高”'), topic: '实验方法要素' },
      { q: 'Falsifiable', a: triple('可证伪', '有可能被证据推翻', '预测若错可被数据否定'), topic: '实验方法要素' },
      { q: 'Operational definitions', a: triple('操作性定义', '用可测量方式定义概念', '压力=心率+问卷分数'), topic: '实验方法要素' },
      { q: 'Independent variable(s)', a: triple('自变量', '被研究者操纵的因素', '是否摄入咖啡因'), topic: '实验方法要素' },
      { q: 'Dependent variable(s)', a: triple('因变量', '被测量的结果', '反应时/考试分数'), topic: '实验方法要素' },
      { q: 'Confounding variables', a: triple('混淆变量', '同时影响DV的额外因素', '咖啡因组也更常熬夜'), topic: '实验方法要素' },
      { q: 'Sample', a: triple('样本', '实际参与研究的人', '60名大学生'), topic: '实验方法要素' },
      { q: 'Population', a: triple('总体', '研究想推广到的人群', '所有大学生'), topic: '实验方法要素' },
      { q: 'Representative sample', a: triple('代表性样本', '特征像总体', '男女比例接近总体'), topic: '实验方法要素' },
      { q: 'Random sampling', a: triple('随机抽样', '从总体随机选人', '名单抽签邀请'), topic: '实验方法要素' },
      { q: 'Convenience sampling', a: triple('便利抽样', '选容易找到的人', '只找本班同学'), topic: '实验方法要素' },
      { q: 'Sampling bias', a: triple('抽样偏差', '样本系统性不代表总体', '只招志愿者导致偏差'), topic: '实验方法要素' },
      { q: 'Generalizability', a: triple('可推广性', '结论能否推广到总体', '只测大学生→难推到老人'), topic: '实验方法要素' },
      { q: 'Experimental group', a: triple('实验组', '接受处理', '喝含咖啡因饮料'), topic: '实验方法要素' },
      { q: 'Control group', a: triple('对照组', '不接受处理/基线', '喝不含咖啡因饮料'), topic: '实验方法要素' },
      { q: 'Placebo', a: triple('安慰剂', '无效处理但看似有效', '无咖啡因但味道一样'), topic: '实验方法要素' },
      { q: 'Single-blind', a: triple('单盲', '被试不知道分组', '被试不知道喝了啥'), topic: '实验方法要素' },
      { q: 'Double-blind', a: triple('双盲', '被试和实验者都不知道', '发饮料的人也不知道'), topic: '实验方法要素' },
      { q: 'Social desirability bias', a: triple('社会期许偏差', '为“好看”而不真实作答', '问吸烟会少报'), topic: '实验方法要素' },
      { q: 'Qualitative (i.e., structured interviews)', a: triple('定性（结构化访谈）', '用文字/访谈收集', '按提纲访谈焦虑经历'), topic: '实验方法要素' },
      { q: 'Quantitative (e.g., Likert scales)', a: triple('定量（李克特量表）', '用数字量化回答', '1-5分同意程度'), topic: '实验方法要素' },
      { q: 'Peer review', a: triple('同行评审', '发表前由专家审核', '期刊审稿'), topic: '实验方法要素' },
      { q: 'Replication', a: triple('重复验证', '其他人用同法再做', '换学校重复同实验'), topic: '实验方法要素' },

      // 非实验方法要素
      { q: 'Variables', a: triple('变量', '会变化的因素', '睡眠、成绩'), topic: '非实验方法要素' },
      { q: 'Directionality problem (correlation)', a: triple('方向性问题', '不知A→B还是B→A', '成绩好→睡更少？'), topic: '非实验方法要素' },
      { q: 'Third variable problem (correlation)', a: triple('第三变量问题', '可能有C同时影响A和B', '压力影响睡眠和成绩'), topic: '非实验方法要素' },
      { q: 'Survey technique', a: triple('调查法', '用问卷收集自报数据', '发问卷测幸福感'), topic: '非实验方法要素' },
      { q: 'Self-report bias', a: triple('自陈偏差', '自己报告可能不准', '记不清或故意隐瞒'), topic: '非实验方法要素' },

      // Ethics
      { q: 'Institutional review', a: triple('伦理审查/IRB', '研究前审查伦理风险', '学校IRB批准后才能做'), topic: 'Ethics' },
      { q: 'Informed consent', a: triple('知情同意', '明确了解并同意参加', '签同意书'), topic: 'Ethics' },
      { q: 'Informed assent', a: triple('未成年人同意（同意意愿）', '未成年本人表达同意', '12岁孩子点头同意'), topic: 'Ethics' },
      { q: 'Protection from harm', a: triple('保护免受伤害', '降低身心风险', '不使用过强电击/羞辱'), topic: 'Ethics' },
      { q: 'Confidentiality', a: triple('保密', '保护个人信息', '数据匿名编号'), topic: 'Ethics' },
      { q: 'Deception', a: triple('欺骗', '为研究需要暂不告知真目的', '告诉“记忆研究”其实测服从'), topic: 'Ethics' },
      { q: 'Research confederates', a: triple('研究同谋/假被试', '研究团队假扮参与者', '同谋故意答错引导从众'), topic: 'Ethics' },
      { q: 'Debriefing', a: triple('事后说明', '实验后解释真实目的', '告知欺骗原因并安抚'), topic: 'Ethics' },

      // 数据与统计
      { q: 'Mean', a: triple('平均数', '总和/人数', '5个分数求平均'), topic: '数据与统计' },
      { q: 'Median', a: triple('中位数', '排序后中间值', '1,2,9→2'), topic: '数据与统计' },
      { q: 'Mode', a: triple('众数', '出现最多的值', '2,2,3→2'), topic: '数据与统计' },
      { q: 'Range', a: triple('极差', '最大-最小', '10-2=8'), topic: '数据与统计' },
      { q: 'Normal curve (with percentages…)', a: triple('正态曲线', '多数集中中间', '68%-95%-99.7%'), topic: '数据与统计' },
      { q: 'Variation', a: triple('变异/离散', '数据分散程度', '分数差距很大'), topic: '数据与统计' },
      { q: 'Skewness', a: triple('偏态', '分布不对称', '多数高分→左偏'), topic: '数据与统计' },
      { q: 'Bimodal distribution', a: triple('双峰分布', '有两个峰', '两类人：很高/很低'), topic: '数据与统计' },
      { q: 'Standard deviation', a: triple('标准差', '离散程度指标', 'SD大=差异大'), topic: '数据与统计' },
      { q: 'Percentile rank', a: triple('百分位', '相对位置', '90th=超过90%的人'), topic: '数据与统计' },
      { q: 'Regression toward mean', a: triple('回归均值', '极端值下次更接近平均', '一次超高分后更正常'), topic: '数据与统计' },
      { q: 'Illusory Correlations', a: triple('错觉相关', '以为有关其实无', '“满月犯罪更多”'), topic: '数据与统计' },
      { q: 'Scatterplot', a: triple('散点图', '展示相关关系', '点越贴线相关越强'), topic: '数据与统计' },
      { q: 'Correlational coefficient', a: triple('相关系数(r)', '-1到+1表示相关方向强度', 'r=+0.8强正相关'), topic: '数据与统计' },
      { q: 'Effect size', a: triple('效应量', '差异/关系实际大小', '两组均值差很大'), topic: '数据与统计' },
      { q: 'Statistical significance', a: triple('统计显著', '结果不太可能因偶然产生', 'p<.05'), topic: '数据与统计' }
    ]
  }

  const apUnit1 = {
    deckTitle: 'AP Psych｜Unit 1',
    tags: apPsychTags,
    cards: [
      { q: 'Central Nervous System', a: triple('中枢神经系统', '脑+脊髓', '脑处理信息'), topic: 'Nervous System' },
      { q: 'Peripheral Nervous System', a: triple('周围神经系统', 'CNS外的神经', '手臂神经传信'), topic: 'Nervous System' },
      { q: 'Autonomic Nervous System', a: triple('自主神经系统', '控制内脏不随意', '心跳、消化'), topic: 'Nervous System' },
      { q: 'Somatic Nervous System', a: triple('躯体神经系统', '控制随意肌肉', '举手、走路'), topic: 'Nervous System' },
      { q: 'Sympathetic Nervous System', a: triple('交感神经', '“战或逃”唤醒', '紧张心跳加快'), topic: 'Nervous System' },
      { q: 'Parasympathetic Nervous System', a: triple('副交感神经', '“休息消化”恢复', '放松后心跳变慢'), topic: 'Nervous System' },

      { q: 'Neuron', a: triple('神经元', '传递神经信息的细胞', '传痛觉信号'), topic: 'Neuron & Chemicals' },
      { q: 'Glial Cells', a: triple('胶质细胞', '支持/保护神经元', '形成髓鞘'), topic: 'Neuron & Chemicals' },
      { q: 'Reflex Arc', a: triple('反射弧', '刺激→脊髓快速反应', '烫到立刻缩手'), topic: 'Neuron & Chemicals' },
      { q: 'Sensory Neurons', a: triple('感觉神经元', '感觉→中枢', '皮肤痛觉到脊髓'), topic: 'Neuron & Chemicals' },
      { q: 'Motor Neurons', a: triple('运动神经元', '中枢→肌肉', '命令手缩回'), topic: 'Neuron & Chemicals' },
      { q: 'Interneurons', a: triple('中间神经元', 'CNS内连接加工', '脊髓里连接感觉与运动'), topic: 'Neuron & Chemicals' },
      { q: 'All-or-Nothing Principle', a: triple('全或无定律', '达阈值就完整放电', '要么发冲动要么不发'), topic: 'Neuron & Chemicals' },
      { q: 'Depolarization', a: triple('去极化', '细胞内更正触发放电', 'Na+进入膜内'), topic: 'Neuron & Chemicals' },
      { q: 'Refractory Period', a: triple('不应期', '放电后短暂不能再放电', '需要恢复离子平衡'), topic: 'Neuron & Chemicals' },
      { q: 'Resting Potential', a: triple('静息电位', '未放电时膜内负外正', '约-70mV'), topic: 'Neuron & Chemicals' },
      { q: 'Reuptake', a: triple('再摄取', '神经递质被回收', 'SSRI阻断再摄取'), topic: 'Neuron & Chemicals' },
      { q: 'Threshold', a: triple('阈值', '触发放电的最低刺激', '达到才会放电'), topic: 'Neuron & Chemicals' },
      { q: 'Multiple Sclerosis', a: triple('多发性硬化', '髓鞘受损影响传导', '肌无力/麻木'), topic: 'Neuron & Chemicals' },
      { q: 'Myasthenia Gravis', a: triple('重症肌无力', '神经肌肉传递受损', '眼睑下垂、易疲劳'), topic: 'Neuron & Chemicals' },
      { q: 'Excitatory Neurotransmitter', a: triple('兴奋性递质', '增加放电可能', '促使神经元更易发火'), topic: 'Neuron & Chemicals' },
      { q: 'Inhibitory Neurotransmitter', a: triple('抑制性递质', '降低放电可能', '让神经元更难发火'), topic: 'Neuron & Chemicals' },
      { q: 'Dopamine', a: triple('多巴胺', '奖赏/运动/学习相关', '成瘾强化、帕金森相关'), topic: 'Neuron & Chemicals' },
      { q: 'Serotonin', a: triple('血清素', '情绪/睡眠相关', '低水平与抑郁相关'), topic: 'Neuron & Chemicals' },
      { q: 'Norepinephrine', a: triple('去甲肾上腺素', '警觉/唤醒', '紧张更警醒'), topic: 'Neuron & Chemicals' },
      { q: 'Glutamate', a: triple('谷氨酸', '主要兴奋性递质', '学习记忆'), topic: 'Neuron & Chemicals' },
      { q: 'GABA', a: triple('γ-氨基丁酸', '主要抑制性递质', '镇静、抗焦虑相关'), topic: 'Neuron & Chemicals' },
      { q: 'Substance p', a: triple('P物质', '疼痛传递', '痛觉增强'), topic: 'Neuron & Chemicals' },
      { q: 'Endorphins', a: triple('内啡肽', '止痛/愉悦', '运动后“runner’s high”'), topic: 'Neuron & Chemicals' },
      { q: 'Acetylcholine', a: triple('乙酰胆碱', '肌肉运动/记忆', '阿尔茨相关下降'), topic: 'Neuron & Chemicals' },
      { q: 'Hormones', a: triple('激素', '血液中化学信使', '甲状腺素影响代谢'), topic: 'Neuron & Chemicals' },
      { q: 'Adrenaline', a: triple('肾上腺素', '应激唤醒激素', '被吓到心跳猛增'), topic: 'Neuron & Chemicals' },
      { q: 'Leptin', a: triple('瘦素', '抑制食欲', '吃饱后更不饿'), topic: 'Neuron & Chemicals' },
      { q: 'Ghrelin', a: triple('胃饥饿素', '增加食欲', '空腹更想吃'), topic: 'Neuron & Chemicals' },
      { q: 'Melatonin', a: triple('褪黑素', '调节睡眠节律', '夜晚困意上升'), topic: 'Neuron & Chemicals' },
      { q: 'Oxytocin', a: triple('催产素', '亲密/信任相关', '拥抱增加亲密感'), topic: 'Neuron & Chemicals' },
      { q: 'Agonist Drugs', a: triple('激动剂', '模仿/增强递质作用', '尼古丁像ACh'), topic: 'Neuron & Chemicals' },
      { q: 'Antagonist Drugs', a: triple('拮抗剂', '阻断递质作用', '纳洛酮阻断阿片'), topic: 'Neuron & Chemicals' },
      { q: 'Stimulants', a: triple('兴奋剂', '提高中枢活动', '提神、心率上升'), topic: 'Neuron & Chemicals' },
      { q: 'Caffeine', a: triple('咖啡因', '兴奋剂，阻断腺苷', '喝咖啡不困'), topic: 'Neuron & Chemicals' },
      { q: 'Cocaine', a: triple('可卡因', '兴奋剂，增加多巴胺', '强奖赏、成瘾'), topic: 'Neuron & Chemicals' },
      { q: 'Depressants', a: triple('抑制剂', '降低中枢活动', '镇静、反应慢'), topic: 'Neuron & Chemicals' },
      { q: 'Alcohol', a: triple('酒精', '抑制剂，影响判断', '反应变慢、冲动'), topic: 'Neuron & Chemicals' },
      { q: 'Hallucinogens', a: triple('致幻剂', '改变知觉体验', '看到不存在的东西'), topic: 'Neuron & Chemicals' },
      { q: 'Marijuana', a: triple('大麻', '改变知觉/放松', '时间感变慢'), topic: 'Neuron & Chemicals' },
      { q: 'Opioids', a: triple('阿片类', '强镇痛、易成瘾', '吗啡止痛'), topic: 'Neuron & Chemicals' },
      { q: 'Heroin', a: triple('海洛因', '强阿片类药物', '强快感、戒断严重'), topic: 'Neuron & Chemicals' },
      { q: 'Addiction', a: triple('成瘾', '强迫使用+耐受戒断', '明知有害仍使用'), topic: 'Neuron & Chemicals' },
      { q: 'Withdrawal', a: triple('戒断', '停用后不适反应', '停酒手抖焦虑'), topic: 'Neuron & Chemicals' },
      { q: 'Tolerance', a: triple('耐受性', '需要更大剂量同效果', '越喝越不醉'), topic: 'Neuron & Chemicals' },

      // Brain
      { q: 'Brain Stem', a: triple('脑干', '维持基本生命功能', '呼吸心跳'), topic: 'Brain' },
      { q: 'Medulla', a: triple('延髓', '呼吸心跳等基本功能', '受损可致命'), topic: 'Brain' },
      { q: 'Reticular Activating System', a: triple('网状激活系统', '觉醒/注意', '被叫醒、保持清醒'), topic: 'Brain' },
      { q: 'Brain’s Reward Center', a: triple('奖赏系统', '奖励/动机通路', '成瘾强化'), topic: 'Brain' },
      { q: 'Cerebellum', a: triple('小脑', '平衡与精细运动', '学骑车'), topic: 'Brain' },
      { q: 'Cerebral Cortex', a: triple('大脑皮层', '高级思维与感知', '语言、计划'), topic: 'Brain' },
      { q: 'Hemispheres (2)', a: triple('大脑半球', '左右分工', '左多语言右多空间'), topic: 'Brain' },
      { q: 'Limbic System', a: triple('边缘系统', '情绪/记忆相关', '恐惧反应'), topic: 'Brain' },
      { q: 'Thalamus', a: triple('丘脑', '感觉中继站', '视觉信息转入皮层'), topic: 'Brain' },
      { q: 'Hypothalamus', a: triple('下丘脑', '稳态/驱力/内分泌', '饥饿、体温调节'), topic: 'Brain' },
      { q: 'Pituitary Gland', a: triple('垂体', '“主激素腺”', '分泌生长激素'), topic: 'Brain' },
      { q: 'Hippocampus', a: triple('海马体', '形成新记忆', '失忆=难形成新记忆'), topic: 'Brain' },
      { q: 'Amygdala', a: triple('杏仁核', '恐惧/情绪加工', '看到蛇立刻害怕'), topic: 'Brain' },
      { q: 'Corpus callosum', a: triple('胼胝体', '连接两半球', '传递信息'), topic: 'Brain' },
      { q: 'Lobes (Occipital, Temporal, Parietal, Frontal)', a: triple('四大脑叶', '不同功能区', '额叶计划、枕叶视觉'), topic: 'Brain' },
      { q: 'Somatosensory Cortex', a: triple('躯体感觉皮层', '触觉/痛觉处理', '手指触觉更敏感'), topic: 'Brain' },
      { q: 'Motor Cortex', a: triple('运动皮层', '发出运动指令', '控制手臂动作'), topic: 'Brain' },
      { q: 'Split Brain Research', a: triple('分脑研究', '切断胼胝体看分工', '左右半球信息不同步'), topic: 'Brain' },
      { q: 'Broca’s Area', a: triple('布洛卡区', '语言表达', '受损说话困难'), topic: 'Brain' },
      { q: 'Wernicke’s Area', a: triple('韦尼克区', '语言理解', '受损听懂困难'), topic: 'Brain' },
      { q: 'Split Brain Patient', a: triple('分脑病人', '胼胝体切断者', '只能用左手选图形'), topic: 'Brain' },
      { q: 'Aphasia', a: triple('失语症', '语言能力受损', '说不出/听不懂'), topic: 'Brain' },
      { q: 'Brain Plasticity', a: triple('大脑可塑性', '经验改变大脑连接', '练琴增强相关区域'), topic: 'Brain' },
      { q: 'Brain Scans (EEG, fMRI)', a: triple('脑成像', '记录/定位脑活动', 'fMRI看血氧变化'), topic: 'Brain' },
      { q: 'Lesioning (Brain Surgical Procedure)', a: triple('脑损毁/切除', '通过损伤推断功能', '切除某区看行为变化'), topic: 'Brain' },

      // Sleep
      { q: 'Consciousness', a: triple('意识', '对自己与环境的觉察', '清醒/昏睡差异'), topic: 'Sleep' },
      { q: 'Circadian Rhythm (Sleep/Wake Cycle)', a: triple('昼夜节律', '约24小时生物钟', '到点自然困'), topic: 'Sleep' },
      { q: 'Disruptions to Circadian Rhythm (jet lag)', a: triple('节律紊乱（时差）', '生物钟被打乱', '出国后睡不着'), topic: 'Sleep' },
      { q: 'Sleep Stages (with EEG patterns)', a: triple('睡眠分期', '不同脑电特征阶段', 'NREM→REM循环'), topic: 'Sleep' },
      { q: 'NREM Stages 1-3', a: triple('非快速眼动1-3期', '从浅睡到深睡', '3期最难叫醒'), topic: 'Sleep' },
      { q: 'Hypnogogic sensations', a: triple('入睡幻觉/抽动', '入睡前坠落感等', '“突然一抖”'), topic: 'Sleep' },
      { q: 'REM Sleep (Paradoxical Sleep)', a: triple('快速眼动睡眠', '梦多、肌肉抑制', '眼动快但身体不动'), topic: 'Sleep' },
      { q: 'Dreaming', a: triple('做梦', '多见于REM', '梦到考试'), topic: 'Sleep' },
      { q: 'REM Rebound', a: triple('REM反弹', '缺REM后REM增加', '熬夜后第二天梦多'), topic: 'Sleep' },
      { q: 'Activation Synthesis dream theory', a: triple('激活-合成理论', '大脑随机信号→编成梦', '把随机活动解释成剧情'), topic: 'Sleep' },
      { q: 'Consolidation dream Theory', a: triple('巩固理论', '梦帮助记忆整合', '复习后梦到内容'), topic: 'Sleep' },
      { q: 'Sleep Function (consolidation/restoration)', a: triple('睡眠功能', '记忆巩固+身体修复', '睡后学习更牢'), topic: 'Sleep' },
      { q: 'Sleep Disorders (the 5 below)', a: triple('睡眠障碍', '睡眠异常类型总称', '失眠/呼吸暂停等'), topic: 'Sleep' },
      { q: 'Insomnia', a: triple('失眠', '入睡/维持睡眠困难', '躺很久睡不着'), topic: 'Sleep' },
      { q: 'Narcolepsy', a: triple('发作性睡病', '白天不可控入睡', '上课突然睡着'), topic: 'Sleep' },
      { q: 'REM Sleep Behavior Disorder', a: triple('REM行为障碍', 'REM时不该动却会动', '做梦时“打人踢人”'), topic: 'Sleep' },
      { q: 'Sleep Apnea', a: triple('睡眠呼吸暂停', '睡中呼吸反复停止', '打鼾+白天嗜睡'), topic: 'Sleep' },
      { q: 'Somnambulism', a: triple('梦游', '多在深睡期发生', '半夜走动不记得'), topic: 'Sleep' }
    ]
  }

  const apSocial = {
    deckTitle: 'AP Psych｜Social Psychology',
    tags: apPsychTags,
    cards: [
      { q: 'Dispositional Attribution', a: triple('性格归因', '解释为内在特质', '“他迟到=懒”'), topic: 'Attribution & Perception' },
      { q: 'Situational Attribution', a: triple('情境归因', '解释为外在环境', '“他迟到=堵车”'), topic: 'Attribution & Perception' },
      { q: 'Optimistic explanatory style', a: triple('乐观解释风格', '坏事=暂时/外因', '考差=这次没复习好'), topic: 'Attribution & Perception' },
      { q: 'Pessimistic explanatory style', a: triple('悲观解释风格', '坏事=永久/内因', '考差=我就是不行'), topic: 'Attribution & Perception' },
      { q: 'Actor-observer bias', a: triple('行动者-观察者偏差', '自己怪情境，别人怪性格', '我迟到=堵车，他迟到=没责任心'), topic: 'Attribution & Perception' },
      { q: 'Fundamental attribution error (FAE)', a: triple('基本归因错误', '低估情境高估性格', '看到插队就说“素质差”'), topic: 'Attribution & Perception' },
      { q: 'Self-serving bias', a: triple('自利偏差', '成功归功自己，失败怪外因', '赢了=我厉害，输了=题太偏'), topic: 'Attribution & Perception' },
      { q: 'External locus of control', a: triple('外控', '觉得结果由外部决定', '“全看运气”'), topic: 'Attribution & Perception' },
      { q: 'Internal locus of control', a: triple('内控', '觉得结果由自己决定', '“努力就能改变”'), topic: 'Attribution & Perception' },
      { q: 'Mere exposure effect', a: triple('单纯曝光效应', '越熟悉越喜欢', '听多了歌更爱'), topic: 'Attribution & Perception' },
      { q: 'Self-fulfilling prophecy', a: triple('自证预言', '期待→行为→结果实现', '觉得会失败就更不努力'), topic: 'Attribution & Perception' },
      { q: 'Social comparison', a: triple('社会比较', '用他人衡量自己', '看同学分数评估自己'), topic: 'Attribution & Perception' },
      { q: 'Relative deprivation', a: triple('相对剥夺感', '比别人差就不满', '自己80但别人90就难受'), topic: 'Attribution & Perception' },
      { q: 'Stereotype (link to prejudice, discrimination)', a: triple('刻板印象', '对群体的概括化信念', '“女生不擅长数学”'), topic: 'Attitudes' },
      { q: 'Implicit attitudes', a: triple('内隐态度', '无意识偏好/偏见', '无意识更信任某群体'), topic: 'Attitudes' },
      { q: 'Just-world phenomenon', a: triple('公正世界信念', '觉得好人有好报', '“受害者一定有原因”'), topic: 'Attitudes' },
      { q: 'Out-group homogeneity bias', a: triple('外群体同质性偏差', '觉得外群体都一样', '“他们都一个样”'), topic: 'Attitudes' },
      { q: 'In-group bias', a: triple('内群体偏好', '偏爱自己群体', '更帮自己班同学'), topic: 'Attitudes' },
      { q: 'Ethnocentrism', a: triple('文化中心主义', '用本文化评判他文化', '觉得别国习俗“奇怪”'), topic: 'Attitudes' },
      { q: 'Belief perseverance', a: triple('信念固着', '证据反驳仍坚持', '数据打脸仍不改观点'), topic: 'Attitudes' },
      { q: 'Cognitive dissonance', a: triple('认知失调', '行为与信念冲突不舒服', '明知不该熬夜仍熬→找借口'), topic: 'Attitudes' },
      { q: 'Social Norms', a: triple('社会规范', '群体默认规则', '电梯里不大声'), topic: 'Social Situations' },
      { q: 'Normative Social Influence', a: triple('规范性影响', '为被接纳而从众', '不想显得另类就跟着做'), topic: 'Social Situations' },
      { q: 'Informational Social Influence', a: triple('信息性影响', '认为别人更懂而从众', '不确定就跟大多数选'), topic: 'Social Situations' },
      { q: 'Elaboration likelihood model', a: triple('精细化可能性模型', '说服走中央/外周路线', '认真想or看外表权威'), topic: 'Social Situations' },
      { q: 'Central route to persuasion', a: triple('中央路径', '用证据逻辑说服', '数据论证改变看法'), topic: 'Social Situations' },
      { q: 'Peripheral route to persuasion', a: triple('外周路径', '靠外在线索说服', '因明星代言而买'), topic: 'Social Situations' },
      { q: 'Halo effect', a: triple('光环效应', '一好遮百丑', '颜值高就觉得人聪明'), topic: 'Social Situations' },
      { q: 'Foot-in-the-door technique', a: triple('得寸进尺', '先小请求再大请求', '先填问卷再捐钱'), topic: 'Social Situations' },
      { q: 'Door-in-the-face effect', a: triple('先大后小', '先大请求被拒再小请求', '先要1000再要50'), topic: 'Social Situations' },
      { q: 'Conformity', a: triple('从众', '跟随群体行为', '大家都选B你也选B'), topic: 'Social Situations' },
      { q: 'Obedience', a: triple('服从', '听从权威命令', '听监考安排不争论'), topic: 'Social Situations' },
      { q: 'Individualism', a: triple('个人主义', '重个人目标', '“做自己最重要”'), topic: 'Social Situations' },
      { q: 'Collectivism', a: triple('集体主义', '重群体和谐', '“别给班里丢脸”'), topic: 'Social Situations' },
      { q: 'Multiculturalism', a: triple('多元文化主义', '尊重多文化并存', '学校庆祝多文化节'), topic: 'Social Situations' },
      { q: 'Group polarization', a: triple('群体极化', '讨论后更极端', '聊完更支持某观点'), topic: 'Social Situations' },
      { q: 'Groupthink', a: triple('群体迷思', '为一致而压制异议', '明知有风险也不反对'), topic: 'Social Situations' },
      { q: 'Diffusion of Responsibility', a: triple('责任分散', '人多就觉得不该我管', '路人多没人报警'), topic: 'Social Situations' },
      { q: 'Social Loafing', a: triple('社会惰化', '团队里更不出力', '小组作业划水'), topic: 'Social Situations' },
      { q: 'Deindividuation', a: triple('去个体化', '匿名→冲动失控', '戴面具更敢闹事'), topic: 'Social Situations' },
      { q: 'Social Facilitation', a: triple('社会助长', '旁观提高熟练任务表现', '有人看你跑更快'), topic: 'Social Situations' },
      { q: 'False consensus effect', a: triple('虚假一致性', '以为大家都同意我', '“大家肯定也这样想”'), topic: 'Social Situations' },
      { q: 'Superordinate goals', a: triple('超级目标', '共同目标促合作', '为班级荣誉一起努力'), topic: 'Social Situations' },
      { q: 'Social Trap', a: triple('社会陷阱', '个人短利损群体', '都乱扔垃圾导致更脏'), topic: 'Social Situations' },
      { q: 'Altruism', a: triple('利他行为', '无私帮助他人', '不求回报帮陌生人'), topic: 'Social Situations' },
      { q: 'Social Responsibility Norm', a: triple('社会责任规范', '应帮助需要帮助的人', '看到老人摔倒去扶'), topic: 'Social Situations' },
      { q: 'Social Reciprocity Norm', a: triple('互惠规范', '别人帮我我也回报', '同学借笔后回请'), topic: 'Social Situations' },
      { q: 'Bystander Effect', a: triple('旁观者效应', '人多反而不帮忙', '公交上大家都不救'), topic: 'Social Situations' }
    ]
  }

  const aFangTranslate = {
    deckTitle: '阿房宫赋｜句子翻译',
    tags: chineseTags,
    cards: [
      {
        q: '**盘盘**焉，**囷囷**焉，',
        a: '它们**回环曲折**，',
        topic: '阿房宫赋'
      },
      {
        q: '**蜂房水涡**，',
        a: '**像蜂房**，**像水涡**（一样稠密层叠），',
        topic: '阿房宫赋'
      },
      {
        q: '矗不知其几千万落。',
        a: '矗立着，不知它们有几千万座。',
        topic: '阿房宫赋'
      },
      { q: '长桥卧波，**未云**何龙？', a: '长桥卧在水上，**没有云**怎么出现了龙？', topic: '阿房宫赋' },
      {
        q: '**复道**行空，',
        a: '**楼阁之间的通道**架在半空，',
        topic: '阿房宫赋'
      },
      {
        q: '不**霁**何虹？',
        a: '并非**雨过天晴**，怎么出现了彩虹？',
        topic: '阿房宫赋'
      },
      { q: '高低**冥迷**，不知西东。', a: '高高低低的楼阁使人**迷惑**，分辨不清西和东。', topic: '阿房宫赋' },
      { q: '歌台**暖响**，春光融融；', a: '人们在台上唱歌，歌声响起，好像**充满暖意**，如同春光一般和煦；', topic: '阿房宫赋' },
      { q: '舞殿**冷**袖，风雨凄凄。', a: '人们在殿里舞蹈，舞袖飘拂，好像**带来寒气**，如同风雨交加那样凄冷。', topic: '阿房宫赋' },
      {
        q: '**鼎铛玉石**，**金块珠砾**，',
        a: '**把宝鼎当作铁锅**，**美玉看成石头**，**黄金视为土块**，**珍珠看作石子**，',
        topic: '阿房宫赋'
      },
      {
        q: '弃掷**逦迤**，',
        a: '扔得**到处都是**，',
        topic: '阿房宫赋'
      },
      {
        q: '秦人视之，亦不甚惜。',
        a: '秦人看着，也不觉得太可惜。',
        topic: '阿房宫赋'
      },
      { q: '一人之心，千万人之心也。', a: '一个人的心思，就是千万人的心思。', topic: '阿房宫赋' },
      { q: '秦爱**纷奢**，人亦**念**其家。', a: '秦始皇喜欢**繁华奢侈**，老百姓也**顾念**自己的家。', topic: '阿房宫赋' },
      {
        q: '**奈何**取之尽**锱铢**，',
        a: '**为什么**搜刮钱财的时候**一分一厘**也不放过，',
        topic: '阿房宫赋'
      },
      {
        q: '用之如泥沙？',
        a: '挥霍起来却像泥沙一样呢？',
        topic: '阿房宫赋'
      },
      { q: '使**负**栋之柱，多于南亩之农夫；', a: '（秦始皇的聚敛，）使阿房宫里**支撑**大梁的柱子，比在田里耕种的农夫还要多；', topic: '阿房宫赋' },
      { q: '架梁之**椽**，多于机上之工女；', a: '架梁的**椽子**，比织机旁的做工的女子还要多；', topic: '阿房宫赋' },
      { q: '使天下之人，**不敢言**而敢怒。', a: '这使得天下人**不敢口上言语**而只敢心中含怒。', topic: '阿房宫赋' },
      { q: '**独夫**之心，日益**骄固**。', a: '**独夫**秦始皇的心，也一天比一天**骄横顽固**。', topic: '阿房宫赋' },
      { q: '秦人**不暇**自哀，而后人哀之；', a: '秦人**来不及**为自己悲哀，而后人为他们悲哀；', topic: '阿房宫赋' },
      {
        q: '后人哀之而不**鉴**之，',
        a: '如果后人为他们悲哀而不以他们**为鉴**，',
        topic: '阿房宫赋'
      },
      {
        q: '亦使后人而**复**哀后人也。',
        a: '也会使更后来的人**再**为后人悲哀了。',
        topic: '阿房宫赋'
      },

      // 促织
      { q: '**为人迂讷**，**遂**为**猾胥**报充**里正**役。', a: '他（成名）**为人迂拙而又不善言辞**，**就**被**狡猾的乡吏**上报到县里，充当**里正**（一职）。', topic: '促织' },
      { q: '成妻**纳**钱案上，**焚拜**如前人。', a: '成名的妻子把钱**放**在案子上，像前边的人一样**烧香跪拜**。', topic: '促织' },
      { q: '**然睹促织**，**隐中**胸怀。', a: '**然而看到画着蟋蟀**，与心事**暗合**（指符合心中的愿望）。', topic: '促织' },
      { q: '成**反复自念**，**得无**教我**猎**虫**所**耶？', a: '成名**反复思量**，**莫非是**指示我**捉**蟋蟀的**地方**吗？', topic: '促织' },
      {
        q: '大喜，**笼**归，举家庆贺，',
        a: '（成名）十分高兴，将它**装在笼子里**带回家，全家庆贺，',
        topic: '促织'
      },
      {
        q: '**虽连城拱壁不啻**也。',
        a: '**即使是价值连城的宝玉也比不上**它。',
        topic: '促织'
      },
      { q: '村中少年**好事者驯养**一虫。', a: '村中有一个**好事的**少年**驯养**着一只蟋蟀。', topic: '促织' },
      { q: '**故**天子一**跬步**，皆**关**民命，不可**忽**也。', a: '**所以**皇帝的**一举一动**，都**关系**到老百姓的生命，不可**忽视**啊。', topic: '促织' }
      ,
      // 烛之武退秦师
      { q: '臣之**壮**也，**犹**不如人；', a: '我**年轻**的时候，**尚且**不如别人；', topic: '烛之武退秦师' },
      { q: '今老矣，**无能为**也**已**。', a: '现在老了，**不能干什么**了（句末语气词，同“矣”）。', topic: '烛之武退秦师' },
      {
        q: '若**舍**郑**以为东道主**，',
        a: '如果您**放弃围攻**郑国而**把它作为东方道路上（招待过客）的主人**，\n（注：“以为”是“以之为”的省略）',
        topic: '烛之武退秦师'
      },
      {
        q: '**行李**之往来，**共**其**乏困**，',
        a: '**外交使者**来来往往，（郑国可以随时）**供给**他们**缺少的资粮**，\n（注：“行李”古义指外交使者；“共”通“供”，供给）',
        topic: '烛之武退秦师'
      },
      {
        q: '君亦无所害。',
        a: '对您也没有什么害处。',
        topic: '烛之武退秦师'
      },
      { q: '**夫**晋，何**厌**之有？', a: '（句首语气词）晋国，怎么会有**满足**的时候呢？\n（注：“厌”通“餍”，满足；“何……之有”为宾语前置句式）', topic: '烛之武退秦师' },
      {
        q: '**既**东**封**郑，又欲**肆**其西**封**，',
        a: '**在东边使**郑国**成为它的边境**之后，又想**扩大**西边的**疆界**，\n（注：“东”方位名词作状语）',
        topic: '烛之武退秦师'
      },
      {
        q: '若不**阙**秦，将**焉**取之？',
        a: '如果不**使**秦国土地**减少**（侵损），将**从哪里**取得它所贪求的土地呢？\n（注：“阙”使动用法，使……减少/侵损）',
        topic: '烛之武退秦师'
      },
      { q: '**阙**秦以**利**晋，**唯**君**图**之。', a: '**削弱**秦国来**使**晋国**得利**，**希望**您**考虑**这件事。\n（注：“唯”表希望；“利”使动用法，使……获利）', topic: '烛之武退秦师' },
      { q: '**微夫人**之力不及此。', a: '**假如没有那个人**（秦穆公）的力量，（我）就没有我的今天。\n（注：“微”意为如果没有；“夫人”古义指那个人）', topic: '烛之武退秦师' },
      {
        q: '**因**人之力而**敝**之，不仁；',
        a: '**依靠**别人的力量，又反过来**损害**他，这是不仁义的；',
        topic: '烛之武退秦师'
      },
      {
        q: '失其**所与**，不**知**；',
        a: '失掉自己的**同盟者**，这是不**明智**的；\n（注：“知”通“智”）',
        topic: '烛之武退秦师'
      },
      {
        q: '以乱**易**整，不武。',
        a: '用混乱相攻**取代**和谐一致，是不符合武德的。',
        topic: '烛之武退秦师'
      }
    ]
  }

  const apUnit2 = {
    deckTitle: 'AP Psych｜Unit 2',
    tags: apPsychTags,
    cards: [
      { q: 'Perception', a: triple('知觉', '对感觉信息进行组织与解释，从而形成对世界的理解。', '把一串声音解释成一句话。'), topic: 'Topic 2.1 Perception' },
      { q: 'Top-Down Processing', a: triple('自上而下加工', '用经验、期望、背景知识来解释输入的信息。', '句子缺字也能读懂，因为你“猜”出来。'), topic: 'Topic 2.1 Perception' },
      { q: 'Bottom-up Processing', a: triple('自下而上加工', '从原始感觉信息出发，逐步组合成整体知觉。', '先看到边线与颜色，再识别出“杯子”。'), topic: 'Topic 2.1 Perception' },
      { q: 'Schemas', a: triple('图式', '关于事物/情境的心理框架，影响理解与记忆。', '你对“餐厅流程”的固定脚本。'), topic: 'Topic 2.1 Perception' },
      { q: 'Perceptual Sets', a: triple('知觉定势', '因期望与经验而倾向以某种方式去“看见”或解释刺激。', '被告知是“动物”后更容易看出那是动物。'), topic: 'Topic 2.1 Perception' },
      { q: 'Gestalt Psychology', a: triple('格式塔心理学', '强调整体知觉：整体不同于部分之和。', '把点连成“形状”而不是一堆点。'), topic: 'Topic 2.1 Perception' },
      { q: 'Closure', a: triple('闭合原则', '倾向把不完整信息补全为完整整体。', '缺一段的圆仍被看成圆。'), topic: 'Topic 2.1 Perception' },
      { q: 'Figure/Ground', a: triple('图形-背景', '在场景中区分关注对象（图形）与其背景。', '读黑板字时把字当图形、黑板当背景。'), topic: 'Topic 2.1 Perception' },
      { q: 'Proximity', a: triple('接近原则', '彼此靠近的元素更容易被看成一组。', '靠得近的点被看成一列。'), topic: 'Topic 2.1 Perception' },
      { q: 'Similarity', a: triple('相似原则', '相似的元素更容易被看成一组。', '同色的点被看成一组。'), topic: 'Topic 2.1 Perception' },
      { q: 'Selective Attention', a: triple('选择性注意', '在众多刺激中选择关注一部分、忽略其他。', '上课只听老师不听走廊声音。'), topic: 'Topic 2.1 Perception' },
      { q: 'Cocktail Party Effect', a: triple('鸡尾酒会效应', '在嘈杂环境中仍能注意到与自己相关的信息。', '人群中听到别人叫你名字立刻转头。'), topic: 'Topic 2.1 Perception' },
      { q: 'Change Blindness', a: triple('变化盲', '未注意到场景中的明显变化。', '电影剪辑错误你没发现。'), topic: 'Topic 2.1 Perception' },
      { q: 'Inattention (Inattentional Blindness)', a: triple('不注意盲视', '注意被占用时，看不到显眼刺激。', '数传球时没看到“黑猩猩”走过。'), topic: 'Topic 2.1 Perception' },
      { q: 'Binocular Depth Cues', a: triple('双眼深度线索', '依赖双眼信息来判断距离。', '用两眼差异判断物体远近。'), topic: 'Topic 2.1 Perception' },
      { q: 'Retinal Disparity', a: triple('视网膜差异', '两眼视网膜成像差异；差异越大物体越近。', '拿手指靠近鼻子会看到双影。'), topic: 'Topic 2.1 Perception' },
      { q: 'Convergence', a: triple('辐辏', '看近物时两眼向内转的程度；越内转越近。', '看很近的字时眼睛更“对眼”。'), topic: 'Topic 2.1 Perception' },
      { q: 'Monocular Depth Cues', a: triple('单眼深度线索', '只用一只眼也能判断距离的线索。', '通过线性透视感到路在远处变窄。'), topic: 'Topic 2.1 Perception' },
      { q: 'Relative Clarity', a: triple('相对清晰度', '远处物体更模糊（大气散射）。', '山越远越发灰。'), topic: 'Topic 2.1 Perception' },
      { q: 'Relative Size', a: triple('相对大小', '同类物体在视网膜成像更小通常更远。', '远处的人看起来更小。'), topic: 'Topic 2.1 Perception' },
      { q: 'Texture Gradient', a: triple('纹理梯度', '远处纹理更细密、细节更少。', '草地远处看起来更平滑。'), topic: 'Topic 2.1 Perception' },
      { q: 'Linear Perspective', a: triple('线性透视', '平行线在远处看似会汇聚。', '铁轨远处看起来合拢。'), topic: 'Topic 2.1 Perception' },
      { q: 'Interposition', a: triple('遮挡/重叠', '一个物体遮住另一个则它更近。', '树挡住房子→树更近。'), topic: 'Topic 2.1 Perception' },
      { q: 'Perceptual Constancy', a: triple('知觉恒常性', '即使距离/光线变，仍把物体知觉为同一大小/形状/颜色。', '人走远了你仍认为他没变小。'), topic: 'Topic 2.1 Perception' },
      { q: 'Apparent Motion/Movement', a: triple('似动/假运动', '静止画面快速切换会被知觉为连续运动。', '翻页动画/电影产生运动感。'), topic: 'Topic 2.1 Perception' },

      { q: 'Concepts', a: triple('概念', '把事物按共同特征归类的心理类别。', '“鸟”这一类包含麻雀、鸽子。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Prototypes', a: triple('原型', '某概念最典型、最“代表性”的例子。', '你脑中“鸟”的原型是麻雀。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Assimilation', a: triple('同化', '把新信息纳入已有图式中理解。', '孩子把鲸鱼也叫“鱼”。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Accommodation', a: triple('顺应/调节', '修改原有图式以适应新信息。', '后来学到鲸鱼是哺乳动物，更新分类。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Algorithms', a: triple('算法', '系统、逐步的解决步骤，保证正确但慢。', '按公式一步步解数学题。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Heuristics', a: triple('启发式', '快速的经验法则，省时但可能出错。', '凭第一印象做选择。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Representativeness Heuristic', a: triple('代表性启发式', '用“像不像原型”来判断概率，易忽略基率。', '更像工程师→就认为他是工程师。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Availability Heuristic', a: triple('可得性启发式', '用想起例子的容易程度估计概率。', '看完空难新闻后觉得飞机更危险。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Mental Set', a: triple('心理定势', '倾向用过去成功的方法解决新问题。', '一直用同一种解题套路。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Priming', a: triple('启动效应', '先前刺激激活相关概念，影响之后反应。', '看到“护士”后更快认出“医生”。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Framing', a: triple('框架效应', '相同信息不同表述会改变选择。', '“成功率90%”比“失败率10%”更让人接受。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Gambler’s Fallacy', a: triple('赌徒谬误', '误以为独立事件会“补偿”前面的结果。', '连出多次正面就觉得下次该反面。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Sunk-Cost Fallacy', a: triple('沉没成本谬误', '因已投入而继续错误决策，而非看未来收益。', '电影很难看但因买票仍看完。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Executive Functions', a: triple('执行功能', '前额叶相关的计划、抑制、工作记忆、灵活切换等。', '控制冲动、按计划复习。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Creativity', a: triple('创造力', '产生新颖且有用的想法/方案。', '想出独特但可行的实验设计。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Divergent Thinking', a: triple('发散思维', '产生多种可能答案/用途。', '想出砖头的10种用途。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Convergent Thinking', a: triple('聚合思维', '把信息收敛到一个最佳答案。', '选择题找到唯一正确项。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },
      { q: 'Functional fixedness', a: triple('功能固着', '只把物体看成常规用途，难以想到新用途。', '只把夹子当夹纸，想不到当钩子。'), topic: 'Topic 2.2 Thinking, Problem-Solving, Judgments, and Decision-Making' },

      { q: 'Memory', a: triple('记忆', '对信息的编码、存储与提取。', '记住昨天的作业内容。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Explicit Memory', a: triple('外显/陈述性记忆', '有意识回忆的事实与经历。', '回忆生日派对细节。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Episodic Memory', a: triple('情景记忆', '关于个人经历与情境的外显记忆。', '记得上周考试时的教室。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Semantic Memory', a: triple('语义记忆', '关于事实、概念与知识的外显记忆。', '知道“上海是中国城市”。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Implicit Memory', a: triple('内隐/非陈述性记忆', '无意识影响行为的记忆。', '会骑车但说不清步骤。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Procedural Memory', a: triple('程序性记忆', '技能与动作的内隐记忆。', '打字、游泳。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Prospective Memory', a: triple('前瞻记忆', '记得将来要做的事。', '记得明天交作业。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Long-term Potentiation', a: triple('长时程增强（LTP）', '突触连接因反复激活而增强，是学习记忆的生理基础之一。', '反复练习后相关神经通路更强。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Working Memory Model', a: triple('工作记忆模型', '把工作记忆分为中央执行系统与多个子系统的模型。', '边听讲边记笔记同时在脑中计算。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Working Memory', a: triple('工作记忆', '短时保持并操作信息的系统。', '心算时暂存数字。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Central Executive', a: triple('中央执行系统', '控制注意与协调工作记忆子系统。', '决定先听题再做题。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Phonological Loop', a: triple('语音回路', '短时保存与复述语音信息。', '默念电话号码防忘。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Visuospatial sketchpad', a: triple('视觉-空间草图板', '短时保持视觉与空间信息。', '在脑中想象路线。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Multi-Store Model', a: triple('多存储模型', '记忆由感觉记忆→短时记忆→长时记忆构成（经典模型）。', '注意并复述可把信息送入长时记忆。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Sensory Memory', a: triple('感觉记忆', '极短暂保存感觉信息。', '闪一下仍残留的画面。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Iconic Memory', a: triple('图像记忆', '视觉感觉记忆，持续极短（约几分之一秒）。', '烟花残影。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Echoic Memory', a: triple('回声记忆', '听觉感觉记忆，持续更久（约2–4秒）。', '别人说完你还能“回放”一句。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Short-term memory', a: triple('短时记忆', '短时间保存信息，容量有限（约7±2或更少）。', '暂时记住一串数字。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Long-term memory', a: triple('长时记忆', '相对持久、容量很大的存储。', '记得母语词汇。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Automatic Processing', a: triple('自动加工', '无需刻意注意就编码的信息（如空间、时间、频率）。', '记得教室在哪里。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Effortful Processing', a: triple('努力加工', '需要注意与练习的编码。', '背单词需要重复。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Encoding', a: triple('编码', '把信息转为大脑可存储形式。', '用联想法记名字。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Storage', a: triple('存储', '把编码信息保存在记忆系统中。', '把知识长期保留。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Retrieval', a: triple('提取', '从记忆中取回信息。', '考试时回忆公式。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Levels of Processing Model', a: triple('加工水平模型', '加工越深（意义加工）记忆越牢。', '理解含义比只看字形记得久。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Structural Processing', a: triple('结构加工', '浅层：关注外形/字体等。', '记“这个词很长”。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Phonemic Processing', a: triple('语音加工', '中层：关注发音。', '记“它押韵”。'), topic: 'Topic 2.3 Introduction to Memory' },
      { q: 'Semantic Processing', a: triple('语义加工', '深层：关注意义与联系。', '把词与自己经历联系起来。'), topic: 'Topic 2.3 Introduction to Memory' }
    ]
  }

  const apUnit4 = {
    deckTitle: 'AP Psych｜Unit 4',
    tags: apPsychTags,
    cards: [
      { q: 'Social Norms', a: triple('社会规范', '群体中被期望的行为规则。', '图书馆保持安静。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Normative Social Influence', a: triple('规范性社会影响', '为了被接纳/避免拒绝而从众。', '不想显得另类就跟着穿同样风格。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Informational Social Influence', a: triple('信息性社会影响', '在不确定时认为别人更懂而从众。', '不会做题就跟大多数选。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Elaboration likelihood model', a: triple('精细化可能性模型（ELM）', '说服有中央路径与外周路径两种。', '有动机时看证据；没动机时看名气。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Central route to persuasion', a: triple('中央路径说服', '通过逻辑与证据改变态度（更持久）。', '用数据论证改变看法。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Peripheral route to persuasion', a: triple('外周路径说服', '靠外在线索（吸引力、权威、情绪）改变态度。', '因明星代言而购买。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Halo effect', a: triple('光环效应', '对某一优点的印象影响对整体评价。', '长得好看就被认为更聪明。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Foot-in-the-door technique', a: triple('得寸进尺', '先小请求再大请求以提高同意率。', '先贴小贴纸→再挂大牌子。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Door-in-the-face effect', a: triple('门当面效应', '先提过大请求被拒→再提较小请求更易接受。', '先要捐1000→再要捐50。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Conformity', a: triple('从众', '改变态度/行为以符合群体。', '明知答案不同仍跟着选同项。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Obedience', a: triple('服从', '听从权威的命令。', '因老师要求而继续任务。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Individualism', a: triple('个人主义', '重个人目标与独立。', '“我为自己负责”。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Collectivism', a: triple('集体主义', '重群体和谐与共同责任。', '“先考虑团队”。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Multiculturalism', a: triple('多元文化主义', '承认并尊重多种文化并存。', '学校庆祝多文化节。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Group polarization', a: triple('群体极化', '群体讨论后观点更极端。', '讨论后更强烈支持某政策。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Groupthink', a: triple('群体迷思', '为一致而压制异议，导致差决策。', '没人反对明显有风险的计划。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Diffusion of Responsibility', a: triple('责任分散', '旁观者越多，个人越觉得不该自己负责。', '人多反而没人报警。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Social Loafing', a: triple('社会惰化', '群体任务中个人出力减少。', '小组作业有人划水。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Deindividuation', a: triple('去个体化', '匿名/群体中自我意识降低、冲动增加。', '戴面具更敢闹事。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Social Facilitation', a: triple('社会助长', '他人在场提高熟练任务表现、可能降低生疏任务表现。', '观众在场跑得更快。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'False consensus effect', a: triple('虚假一致性效应', '高估他人与自己观点一致的程度。', '以为“大家都同意我”。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Superordinate goals', a: triple('超级目标', '需要合作才能实现的共同目标。', '两组为了救援一起搬重物。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Social Trap', a: triple('社会陷阱', '个人短期利益导致群体长期损失。', '过度捕捞破坏渔业。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Industrial-Organizational Psychology', a: triple('工业/组织心理学', '把心理学用于工作场所：招聘、培训、效率等。', '设计面试与绩效评估。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Altruism', a: triple('利他', '无私帮助他人（不求回报）。', '匿名捐款。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Social Responsibility Norm', a: triple('社会责任规范', '应帮助需要帮助的人。', '帮助受伤的陌生人。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Social Reciprocity Norm', a: triple('互惠规范', '别人帮我，我也应回报。', '同学借你笔，你后来也帮他。'), topic: 'Topic 4.3 Psychology of Social Situations' },
      { q: 'Bystander Effect', a: triple('旁观者效应', '旁观者越多，帮助行为越少。', '拥挤地铁里没人上前帮忙。'), topic: 'Topic 4.3 Psychology of Social Situations' },

      { q: 'Psychodynamic perspective', a: triple('心理动力学观点', '强调无意识冲突与早期经历影响人格与行为。', '用防御机制解释焦虑。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Unconscious processes', a: triple('无意识过程', '不在意识层面但影响想法、情绪与行为的过程。', '无意识偏见影响判断。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Ego defense mechanisms', a: triple('自我防御机制', '降低焦虑、保护自尊的无意识策略。', '把失败怪到外界。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Denial', a: triple('否认', '拒绝接受现实或事实。', '诊断后说“我没事”。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Displacement', a: triple('移置', '把情绪转移到更安全的对象上。', '被老师批评后回家对家人发火。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Projection', a: triple('投射', '把自己的不可接受想法归到别人身上。', '自己嫉妒却说“他嫉妒我”。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Rationalization', a: triple('合理化', '用看似合理的理由掩盖真实动机。', '没复习考差却说“题太偏”。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Reaction formation', a: triple('反向形成', '把真实冲动转为相反行为。', '其实讨厌某人却表现得特别友好。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Regression', a: triple('退行', '在压力下回到更幼稚的行为方式。', '高中生受挫后像小孩一样哭闹。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Repression', a: triple('压抑', '把痛苦想法/记忆推入无意识（精神分析）。', '对创伤细节完全想不起来。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Sublimation', a: triple('升华', '把不可接受冲动转为社会认可的行为。', '把攻击冲动转为打竞技运动。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Projective tests', a: triple('投射测验', '用模糊刺激引出投射反应来推测人格。', '罗夏墨迹测验。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Unconditional (positive) regard', a: triple('无条件积极关注', '来访者无论如何都被接纳与尊重（罗杰斯）。', '治疗中不评判地倾听。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Humanistic Perspective/psychology', a: triple('人本主义心理学', '强调自我、成长、自由意志与主观体验。', '关注自尊与自我实现。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },
      { q: 'Self-actualizing tendency', a: triple('自我实现倾向', '人具有追求潜能实现与成长的内在动力。', '不断挑战更高目标。'), topic: 'Topic 4.4 Psychoanalytic and Humanistic Theories of Personality' },

      { q: 'Social-cognitive theory', a: triple('社会认知理论', '强调观察学习、认知与环境交互影响行为（班杜拉）。', '看别人被奖励就模仿。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Reciprocal determinism', a: triple('交互决定论', '人(认知/人格)、行为、环境相互影响。', '自信→多练习→环境反馈更好→更自信。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Self-efficacy', a: triple('自我效能感', '相信自己能完成任务的信念。', '相信能学会微积分→更坚持。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Self-esteem', a: triple('自尊', '对自我价值的总体评价。', '觉得自己“值得被尊重”。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Self-concept', a: triple('自我概念', '对“我是谁”的信念集合（特质、角色等）。', '认为自己是“理科生”。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Trait theories', a: triple('特质理论', '用稳定特质维度描述人格。', '外向、尽责等。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Big 5 Theory of Personality (OCEAN)', a: triple('大五人格（OCEAN）', '开放性、尽责性、外向性、宜人性、神经质五维。', '高尽责的人更自律。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Personality inventories', a: triple('人格量表/问卷', '用自陈题项测人格特质。', 'MMPI或大五问卷。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' },
      { q: 'Factor Analysis', a: triple('因素分析', '统计方法：从相关题项中提取潜在因素。', '从多题中提取“大五”维度。'), topic: 'Topic 4.5 Social-Cognitive and Trait Theories' }
    ]
  }

  const apIO = {
    deckTitle: 'AP Psych｜Industrial-Organizational',
    tags: apPsychTags,
    cards: [
      { q: 'Industrial-Organizational Psychology', a: triple('工业组织心理学', '工作场景心理学应用', '用测评提升招聘匹配'), topic: 'Industrial-Organizational' }
    ]
  }

  // 官方默认卡包（社区展示/可收藏）
  return [act, finalReview, apUnit0, apUnit1, apSocial, aFangTranslate, apUnit2, apUnit4]
}

module.exports = { getOfficialDefaultDecks }


