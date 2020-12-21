# sourceManage-back-end
* the back-end of sourceManage built with express（用express写的校园资源管理系统的后端接口），没有分模块，只有一个index.js从头写到尾。。。用的MySQL、express.js和redis等，具体的接口和一些库的导入在文件中都有注释。
* 整理下来发现很多接口的请求方法都是post，这个当时主要是考虑到表单的处理比较多，也是为了方便（懒）
## 接口分类
> 登录注册模块：
* 发送验证码：path:'/user/verify', method: post, res: code(验证码), expire(有效时间), email(邮箱)
* 注册接口: path: '/user/signup'; method: post; query: userName,password,email,code; res: code(状态码)，msg(状态信息)
* 登录接口: path: '/user/login'; method: post; query: name, password; res: code,msg
* 注销接口: path: '/user/logout'; method: get; res: code, msg

> 资源相关模块
* 获取资源列表: path: '/source/list', method: post, params: pageSize, pageNum; res: code, data(数据总数目和列表数据),msg
* 条件搜索资源: path: '/source/search'; method: post, query: pageSize,pageNum, Id, Name, Type(条件可为空)；res: code, data, msg
* 添加资源: path: '/source/add'; method: post; params: sourceName, sourceType, capacity, description; res: code, msg
* 更新资源: path: '/source/update'; method: post; params: sourceName, sourceType, capacity, description; res: code, msg
* 删除资源: path: '/source/delete'; method: post; params: userType, sourceId; res: code, msg

> 表格相关模块
* 创建申请表: path: '/apply/create'; method: 'post'; params: sourceName, sourceType, applyDate, applyTime, cause, applier, applyComment, next_deal_role; res: code, msg
* 修改申请表，点击修改按钮后获取修改后的相关数据。。。（描述省略）
* 提交申请表、通过申请表、拒绝申请表
* 查看待处理的申请表
* 查看个人申请表、查看申请表的详细信息
* 创建报修表、查看个人报修表、查看待处理的报修表
* 处理报修表

> 评论模块
* 获取所有评论：path: '/comment/all'; method: post; res: comment(主评论)，reply(回复); 
* 添加评论: path: '/comment/new'; method: post; params: fromId, fromName, content, fromAvatar(头像),likeNum(点赞人数); res: code, msg
* 回复评论: path: '/comment/reply'; method: post; params: fromName,fromId, commentId, fromAvatar, toId, toName, toAvatar, content; res: code, msg
* 点赞： path: '/comment/like'; method: post; params: id, likeNum;  res: code, msg

> 其他模块
* 修改密码：path: '/password'; method: post; params: name, password, newPassword; res: code, msg
* 获取用户列表：path: '/user/list'; method: post; 
* 新增管理员: path: '/admin/new/'; method: post; params: name, password, email, type, state; res: code, msg
* 分配角色: path: '/user/role'; method: post; params: id, email, type; res: code,msg
* 根据id删除用户: path: '/user/delete'; method: post; params: id; res: code, msg

> 文章模块
* 新建文章、查询文章、根据id查询文章详细信息、更新文章、删除文章公告、根据创作者获取文章信息（具体可以看代码）

## Tips
* 数据库表可以根据字段来创建，sql文件我也上传了一份到仓库，要注意一些时间的值设置，推荐使用 Navicat for MySQL,[传送门](https://www.navicat.com.cn/products/navicat-for-mysql)
* 一些库或者插件的版本错误可以直接百度
* 邮箱发送使用qq邮箱的smtp服务，免费且好用，详情 [传送门](https://service.mail.qq.com/cgi-bin/help?subtype=1&no=166&id=28)
* 验证码保存用redis， 用的这个库，[传送门](https://github.com/NodeRedis/node-redis)
* 本地开发要设置跨域请求头，在前端处理也可以，如果部署到线上，需要在服务器配置nginx跨域，[推荐了解](https://www.jianshu.com/p/734ef8e5a712)

## Clone&Run
* 首先创建一个本地的数据库，将相关sql表格导入，然后配置mysql连接池，包括域名、端口号、账户密码、数据库名称等
* 然后根据前端的端口配置跨域的域名和端口号，node index.js 就可以启动服务，默认是在5050端口




