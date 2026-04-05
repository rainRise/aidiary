# 外部情绪词典目录说明

该目录用于放置可选的外部情绪词典（如 NTUSD 简体词典）。

## 默认文件名

1. `ntusd_positive_simplified.txt`
2. `ntusd_negative_simplified.txt`

## 支持格式

每行一个词，或 `词<TAB>分数` / `词 空格 分数`，程序会取第一列作为词条。

示例：

```txt
开心
愉快
焦虑
难过
兴奋    0.9
烦躁 0.8
```

## 启用方式

`emotion_feature_service.py` 默认启用外部词典融合。

可通过环境变量控制：

1. `EMOTION_EXT_LEXICON_ENABLED=true|false`
2. `EMOTION_EXT_LEXICON_WEIGHT=0.65`
3. `EMOTION_EXT_LEXICON_POS_PATH=/abs/path/ntusd_positive_simplified.txt`
4. `EMOTION_EXT_LEXICON_NEG_PATH=/abs/path/ntusd_negative_simplified.txt`

若默认路径找不到词典文件，会自动跳过，不影响服务启动。
