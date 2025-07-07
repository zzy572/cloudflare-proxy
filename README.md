# Cloudflare Workers/Pages Trojan 代理

这是一个部署在 Cloudflare Workers/Pages 上的 Trojan 协议代理服务。本项目基于 [@yonggekkk/Cloudflare-vless-trojan](https://github.com/yonggekkk/Cloudflare-vless-trojan) 修改，增加了 `proxydomains` 参数支持。

## 主要特点

- 支持 Trojan 协议
- 支持部署在 Cloudflare Workers/Pages 上
- 新增 `proxydomains` 参数，用于指定需要通过 proxyip 访问的域名
- 解决了 Twitter 等服务在 CF IPv6 网络下无法访问的问题

## 为什么需要 proxydomains？

Cloudflare 的节点中包含 IPv6 地址，这会导致某些服务（如 Twitter）无法正常访问。通过 `proxydomains` 参数，我们可以指定特定域名通过 proxyip 访问，而不是通过 Cloudflare 网络访问，从而解决访问问题。

## 配置说明

| 变量作用 | 变量名称 | 变量值要求 | 变量默认值 | 变量要求 |
|---------|---------|------------|------------|---------|
| Trojan 密码 | pswd | 字符串 | 万人骑密码：trojan | 建议修改 |
| 代理服务器 IP | proxyip | 443端口：ipv4地址、[ipv6地址]、域名。非443端口：IPV4地址:端口、[IPV6地址]:端口、域名:端口 | 留空 | 可选 |
| 订阅节点：优选IP | ip1到ip13，共13个 | CF官方IP、CF反代IP、CF优选域名 | CF官方不同地区的visa域名 | 可选 |
| 订阅节点：优选IP对应端口 | pt1到pt13，共13个 | CF13个标准端口、反代IP对应任意端口 | CF13个标准端口 | 可选 |
| 指定代理域名 | proxydomains | 字符串 | 留空 | 可选，格式如：twitter.com, x.com |


## 查看配置信息

在浏览器地址栏输入：
```
https://你的域名/你的密码
```

## 客户端配置

支持所有兼容 Trojan 协议的客户端，例如：
- v2rayN
- Qv2ray
- Shadowrocket
- Clash

## 注意事项

1. 默认提供了作者本人的 `proxyip`，建议有条件的朋友使用自己的，我自己的不保证可用性
2. `proxyip` 那台服务器需要禁用 ipv6，否则仍然无法访问twitter（因为twitter目前禁止使用ipv6访问）
3. 目前默认添加了 ["x.com","twitter.com"]，这两个域名及其所有子域名的请求都会通过 `proxyip` 访问，如果需要更多，需要自行通过 `proxydomains` 变量设置

## 致谢

- [@yonggekkk](https://github.com/yonggekkk) - 原项目作者

## 免责声明

本项目仅供学习交流使用，请遵守当地法律法规。
