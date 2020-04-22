
let mode = 'PRODUCTION';
// let mode = 'DEVELOPMENT';

let  Email = {
  redis: {
    get host () {
      // return '127.0.0.1' 本地地址
      return '120.78.15.79'
    },
    get port () {
      return 6379
    }
  },
  smtp: {
    get host() {
      return 'smtp.qq.com'
    },
    get user() {
      return '1668150723@qq.com'
    },
    get pass() {
      return 'wurchudpuqaheaed' // smtp授权码
    },
    get code() {
      return () => {
        return Math.random().toString(16).slice(2,6).toUpperCase()
      }
    },
    get expire() {
      return ()=>{
        return new Date().getTime()+60*60*1000
      }
    }
  }
}
let nodeMailer = require('nodemailer')

let mysql = require('mysql')

let pool
if (mode === 'PRODUCTION') {
  pool = mysql.createPool({
    host: '120.78.15.79',
    port: '3306',
    user: 'root',
    password: '123456',
    database: 'sourceManage',
    connectionLimit: '50',
    multipleStatements: true
  })
} else {
  pool = mysql.createPool({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '12345',
    database: 'sourcemanage',
    connectionLimit: '10',
    multipleStatements: true
  })
}
// pool = mysql.createPool({
//   host: 'localhost',
//   port: '3306',
//   user: 'root',
//   password: '12345',
//   database: 'sourcemanage',
//   connectionLimit: '10',
//   multipleStatements: true
// })

// 导包
let express = require('express')
let cookieParser = require('cookie-parser')
let session = require('express-session')
// let jwt = require('jwt-simple')

let server = express()
// server.set('jwtTokenSecret', 'WSJ')
server.use(cookieParser())
server.use(session({
  name: 'sourcemanage',
  secret: 'sourcemanage',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false
  }
}))

let port = 5050
server.listen(port, () => {
  console.log('服务器启动成功，正在监听端口：', port)
})

server.use(express.urlencoded({
  extended:false
}))

server.use(express.json())

server.use(function (request, response, next) {
  if (mode === 'PRODUCTION') {
    response.header("Access-Control-Allow-Origin", "*")
  } else {
    response.header("Access-Control-Allow-Origin", "http://localhost:8080");//前端域名
  }
  response.header("Access-Control-Allow-Credentials",'true');
  response.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next()
})

let Redis = require('redis')
let client = Redis.createClient()
client.on("error", function (err) {
  // console.log("Error " + err);
  throw err
});

/**
 * 发送验证码
 */
server.post('/user/verify', (req, res) => {
  let userName = req.body.userName
  const saveExpire = client.hget(`nodemail:${userName}`, 'expire')
  if (saveExpire && new Date().getTime() - saveExpire < 0) {
    res.json({code: 404, msg: '验证过于频繁，一分钟一次'})
    return false
  }
  let transporter = nodeMailer.createTransport({
    host: Email.smtp.host,
    port: 587,
    secure: false,
    auth: {
      user: Email.smtp.user,
      pass: Email.smtp.pass
    }
  })
  let ko = {
    code: Email.smtp.code(),
    expire: Email.smtp.expire(),
    email: req.body.email,
    user: req.body.userName
  }
  let mailOptions = {
    from: `"认证邮件" <${Email.smtp.user}>`,
    to: ko.email,
    subject: '校园资源管理系统验证码',
    html: `您在校园资源管理系统中注册，您的验证码是:${ko.code}`
  }
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log('error')
    } else {
      client.hmset(`nodemail:${ko.user}`, 'code',ko.code,'expire',ko.expire,'email',ko.email)
    }
  })
  res.json({code: 200, msg: '验证码已发送，可能存在延时，有效期一分钟'})
})

/**
 * 注册
 */
server.post('/user/signup', (req, res) => {
  const {
    userName,
    password,
    email,
    code
  } = req.body;
  if (code) {
    client.hgetall(`nodemail:${userName}`, function (err, value) {
      // console.log(value.code);
      // console.log(value.expire);
      if (code === value.code) {
        if (new Date().getTime() - value.expire > 0) {
          res.json({code: 401, msg: '验证码已过期，请重新尝试'});
          return false
        }
      } else {
        return res.json({code:401, msg:'请填写正确的验证码'})
      }
    })
  } else {
    return res.json({code: 401, msg: '请填写验证码'})
  }
  let sqlOne = 'select * from user where name=?'
  let sqlTwo = 'insert into user values(null,?,?,?,?,NOW(),NOW(),?)';
  let state = 1, type = 2;
  pool.query(sqlOne, [userName], (err, result) => {
    if (err) {
      throw err
    }
    if (result.length) {
      return res.json({code:401, msg:'已被注册'})
    } else {
      pool.query(sqlTwo, [userName,password,email,type,state], (err, result) => {
        if (err) {
          throw err
        }
        if (result) {
          return res.json({code:200, msg:'注册成功'})
        } else {
          return res.json({code:500, msg:'注册失败'})
        }
      })
    }
  })
})

/**
 * 用户登录
 * @params [name,password] 必选
 *
 */
server.post('/user/login', function (req,res) {
  let name = req.body.name
  let password = req.body.password
  if(name === '') {
    res.json({code:401, msg: '请输入员工编号'})
    return
  }
  if(password === '') {
    res.json({code:402, msg: '请输入密码'})
    return
  }
  let sql = 'SELECT * FROM user WHERE name=? and password=?'
  pool.query(sql, [name, password], (err, result) => {
    if(err) throw err
    if(result != '') {
      // console.log(name)
      req.session.name = name;
      // console.log(result[0])
      let type = result[0].type;
      let email = result[0].email;
      let id = result[0].id;
      req.session.id = id;
      req.session.type = type;
      req.session.email = email;

      res.json({code:200, name: result[0].name, email: email, type: type, id: id})
      // console.log(result)
    }else {
      res.json({code:403, msg: '账号或密码错误'})
    }
  })
})

/**
 * 用户注销，删除session记录，前端退出到登录页面
 */
server.get('/user/logout', (req, res) => {
  // console.log(req.session.name) // 有值,为用户名
  delete req.session.name
  delete req.session.type
  delete req.session.email
  res.json({code:200, msg:'注销成功'})
  // console.log(res)
  // console.log(req.session.name + '推出了') // 没有值，为undefined
})

/**
 * 查看账号信息 --- 在前端处理
 */

// server.get('/userInfo', (req, res) => {
//   let name = req.localStorage.
// })

/**
 * 获取资源列表
 */
server.post('/source/list', (req, res) => {
  let params = req.body;
  // console.log(params);

  // 分页查询入参
  let page = params.pageNum;
  let pageSize = params.pageSize ? params.pageSize : 10;
  let offsetPage = (page - 1)*pageSize;
  // console.log(page);
  // console.log(offsetPage);

  let sqlSelectTotal = 'select count(*) as totalCount from source_list where state != 2'
  let sqlSelectList = 'select id,source_type,source_name,source_capacity,description from source_list where state = 1 '

  // if (searchId != null) {
  //   // console.log(searchId)
  //   sqlSelectTotal += " and id = "+searchId;
  //   sqlSelectList += " and id = "+searchId;
  // }
  // if (searchName != null) {
  //   // console.log(searchName)
  //   sqlSelectTotal += " and source_name = "+searchName
  //   sqlSelectList += " and source_name = "+searchName
  // }
  // if (searchType != null) {
  //   sqlSelectTotal += " and source_type = "+searchType
  //   sqlSelectList += " and source_type = "+searchType
  // }

  let sql = sqlSelectTotal + ';' + sqlSelectList
  sql += 'order by id limit ? offset ?';
  pool.query(sql,[pageSize,offsetPage],(err, result) => {
    if (err) {
      throw err
    }
    if (result != '') {
      let resData = {};
      // console.log(result[0][0]);
      // console.log(result[1]);
      resData.totalCount = result[0][0]['totalCount'];
      resData.list = result[1];
      //
      // console.log(result[1][result[1].length-1])
      res.json({code: 200, data: resData, message: '获取列表成功'})
    } else {
      res.json({code: 404, message: '不存在该资源'})
    }
  })
});

/**
 * 根据条件搜索资源
 * @params [id, source_type, source_name]
 * 可能为空，非必选字段
 * post请求
 */
server.post('/source/search', (req, res) => {
  let params = req.body;
  let pageNum = params.pageNum
  let pageSize = params.pageSize ? params.pageSize : 10;
  let offsetPage = (pageNum - 1)*pageSize;
  let searchId = parseInt(params.searchId);

  let searchName = params.searchName;
  // console.log(searchName)
  let searchType = params.searchType;
  let sqlSelectTotal = 'select count(*) as totalCount from source_list where state = 1 '
  let sqlSelectList = 'select id,source_type,source_name,source_capacity,description from source_list where state = 1 '
  if (searchId) {
    sqlSelectTotal += " and id = "+searchId;
    sqlSelectList += " and id = "+searchId;
  }
  if (searchName) {
    // console.log('进来了')
    // console.log(typeof searchName)
    sqlSelectTotal += " and source_name = '"+searchName+"'" ;
    sqlSelectList += " and source_name = '"+searchName+"'";
    // console.log(sqlSelectTotal);
    // console.log(sqlSelectList);
  }
  if (searchType) {
    sqlSelectTotal += " and source_type = '"+searchType+"'";
    sqlSelectList += " and source_type = '"+searchType+"'";
  }
  let sql = sqlSelectTotal + ';' + sqlSelectList
  sql += ' order by id limit ? offset ? ';
  // console.log(sql);
  pool.query(sql,[pageSize,offsetPage],(err, result) => {
    if (err) {
      throw err
    }
    // console.log(result)
    if (result != '') {
      let resData = {};
      // console.log(result[0][0]);
      // console.log(result[1]);
      resData.totalCount = result[0][0]['totalCount'];
      resData.list = result[1];
      res.json({code: 200, data: resData, message: '获取列表成功'})
    } else {
      res.json({code: 404, message: '不存在该资源'})
    }
  })
})

/**
 * 管理员添加资源
 * 表单数据：source_name source_type capacity description
 */

server.post('/source/add', (request, response) => {
  let params = request.body;
  let source_name = params.sourceName;
  let source_type = params.sourceType;
  let source_capacity = params.capacity;
  let description = params.description;
  if (!source_name) {
    response.json({code:401, msg: '请输入资源名称'})
  }
  if (!source_type) {
    response.json({code:401, msg: '请选择资源所属分类'})
  }
  if (!source_capacity) {
    response.json({code:402, msg: '请输入容量或不限'})
  }
  if (!description) {
    response.json({code:403, msg: '请输入简单的相关描述'})
  }
  let sqlOne = 'SELECT * FROM source_list WHERE source_name= ?';
  pool.query(sqlOne, [source_name], (err, result) => {
    if (err) throw err
    if (result.length > 0) {
      response.json({code: 401, msg: '该资源名称已经存在'})
    } else {
      let sqlTwo = 'insert into source_list (source_name, source_type, source_capacity, description) values(?,?,?,?)'
      pool.query(sqlTwo, [source_name, source_type, source_capacity, description], (err, result) => {
        if (err) throw err
        response.json({code:200, msg: '添加成功'})
      })
    }
  })
})

/**
 * 更新资源信息
 */
server.post('/source/update', (request, response) => {
  let params = request.body;
  let id = params.editId;
  let source_name = params.sourceName;
  let source_type = params.sourceType;
  let source_capacity = params.capacity;
  let description = params.description;
  if (!source_name) {
    response.json({code: 401, msg: '请输入资源名称'})
    return
  }
  if (!source_type) {
    response.json({code: 402, msg: '请选择资源分类'})
    return
  }
  if (!source_capacity) {
    response.json({code: 403, msg: '请输入该资源的容量'})
    return
  }
  if (!description) {
    response.json({code: 404, msg: '请输入相关描述'})
    return
  }
  let sql = 'update source_list set source_name=?, source_type=?, source_capacity=?, description=? WHERE id=?';
  pool.query(sql, [source_name, source_type, source_capacity, description, id], (err, res) => {
    // console.log(res)
    if (err) throw err;
    return response.json({code: 200, msg:'编辑成功'})
  })
})

/**
 * 管理员删除资源
 * @params [id, user_type]
 */
server.post('/source/delete', (request, response) => {
  let params = request.body;
  let userType = params.userType;
  let id = params.sourceId;
  if (userType !== 1) {
    response.json({code:401, msg:'你无权删除该资源'})
  } else {
    let sql = 'delete from source_list where id=?';
    pool.query(sql, [id], (err, result) => {
      if (err) {
        return response.json({code: 500, msg:'服务器错误'});
      }
      return response.json({code: 200, msg: '删除成功'})
    })
  }
})

/**
 * 创建资源申请表并保存
 */
server.post('/apply/create', (request, response) => {
  let params = request.body;
  let sourceName = params.sourceName;
  let sourceType = params.sourceType;
  let apply_date = params.applyDate;
  let apply_time = params.applyTime;
  let cause = params.cause;
  let applier = request.session.name;
  let apply_comment = params.applyComment;
  let status = '已创建';
  let next_deal_role = request.session.name;
  if (!apply_time || !apply_date) {
    response.json({code: 500, msg: '申请时间或日期不能为空'})
    return
  }
  if (!cause) {
    response.json({code: 501, msg: '申请用途不能为空'})
    return
  }
  let sqlOne = 'insert into source_apply values(null,?,?,?,NOW(),?,?)';
  let sqlTwoFinish = false;
  // 创建报销单
  pool.query(sqlOne, [sourceName, cause, applier, next_deal_role, status], (errOne, result) => {
    if (errOne) {
      response.json({code: 500, msg:'服务器错误'});
      return
    }
    let source_apply_id = result.insertId;
    // let source_apply_id = 1;
    // 创建申请表的处理记录
    let deal_way = '创建';
    let deal_result = '保存';
    let deal_comment = '创建申请表';
    let sqlTwo = "insert into deal_record values(null,?,?,DATE_FORMAT(NOW(),'%Y-%m-%d'),?,?,?)";
    pool.query(sqlTwo,[source_apply_id,applier,deal_way,deal_result,deal_comment], (err, result) => {
      if (err) {
        response.json({code: 500, msg:'服务器错误'});
        return
      }
      sqlTwoFinish = true;
      // response.json({code: 200, msg: '保存成功'})
    })
    let sqlThree = 'insert into source_apply_detail values(null,?,?,?,?,?)';
    pool.query(sqlThree, [source_apply_id,sourceType,apply_date,apply_time,apply_comment], (err, result) => {
      if (sqlTwoFinish && result) {
        return response.json({code: 200, msg: '保存成功'});
      }
    })
  })
})

/**
 * 点击修改按钮获取所需的数据
 */
server.post('/apply/before-update', (request, response) => {
  let params = request.body;
  let source_apply_id = params.id;
  let sql = 'select * from source_apply_detail where source_apply_id=?';
  pool.query(sql, [source_apply_id], (err, result) => {
    if (err) {
      response.json({code:200, msg:'服务器错误'});
      throw err;
    } else {
      let resData = result[0];
      // console.log(result);
      return response.json({code:200, data: resData});
    }
  })
})


/**
 * 修改申请表
 */
server.post('/apply/update', (request, response) => {
  let params = request.body;
  let name = request.session.name;
  let cause = params.cause;
  let apply_source_id = params.id;
  let apply_date = params.date;
  let apply_time = params.time;
  let apply_comment = params.applyComment;
  let status = '已修改';
  let applyFinish = false;
  let recordFinish = false;
  let detailFinish = false;
  let resData = [cause, status];
  let sqlOne = 'update source_apply set cause=?,status=? where id=?';
  pool.query(sqlOne, [cause, status, apply_source_id], (err, result) => {
    if (err) {
      response.json({code:500, msg: '服务器错误'})
      throw err;
    }
    applyFinish = true;
    if (recordFinish && detailFinish) {
      return response.json({code:200, mag:'修改成功',data: resData})
    }
  })
  // 修改申请表明细
  let sqlTwo = 'update source_apply_detail set apply_date=?,apply_time=?,comment=? where source_apply_id=?';
  pool.query(sqlTwo, [apply_date, apply_time, apply_comment, apply_source_id], (err, result) => {
    if (err) {
      response.json({code: 500, msg: '服务器错误'})
      throw err;
    }
    detailFinish = true;
    if (applyFinish && recordFinish) {
      return response.json({code:200, msg:'修改成功',data: resData})
    }
  })
  // 更新处理记录
  let deal_way = '修改';
  let deal_result = '已修改';
  let comment = '修改申请表';
  let sqlThree = 'insert into deal_record values(null,?,?,NOW(),?,?,?)';
  pool.query(sqlThree, [apply_source_id,name,deal_way,deal_result,comment], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'});
      throw err;
    }
    detailFinish = true;
    if (applyFinish && detailFinish) {
      return response.json({code:200, msg:'修改成功',data: resData})
    }
  })
})

/**
 * 提交申请表
 */
server.post('/apply/submit', (request, response) => {
  let name = request.session.name;
  // let type = request.session.type;
  let source_apply_id = request.body.id;
  // let source_name = request.body.sourceName;
  // let cause = request.body.cause;
  let status = '已提交';
  let submitFinish = false;
  let recordFinish = false;
  let next_deal_role = '管理员';
  let role_type = 1;
  let sqlOne = 'update source_apply set next_deal_role=?, status=? where id = ?';
  pool.query(sqlOne, [next_deal_role, status, source_apply_id], (err, result) => {
    submitFinish = true;
    if (recordFinish) {
      response.json({code:200, msg: '提交成功'})
    }
  })
  //处理更新记录
  let deal_way = '提交';
  let deal_result = '已提交';
  let comment = '提交申请表';
  let sqlTwo = 'insert into deal_record values(null,?,?,NOW(),?,?,?)';
  pool.query(sqlTwo, [source_apply_id, name, deal_way,deal_result,comment], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'});
      throw err;
    }
    recordFinish = true;
    if (submitFinish) {
      return response.json({code:200, msg:'提交成功'})
    }
  })
})

/**
 * 通过申请表
 */
server.post('/apply/agree', (request, response) => {
  let deal_user = request.session.name;
  let source_apply_id = request.body.id;
  let comment = request.body.comment;
  let status = '已通过';
  let next_deal_role = '主管';
  let applyFinish = false;
  let recordFinish = false;
  let sqlOne = 'update source_apply set next_deal_role=?,status=? where id=?';
  pool.query(sqlOne, [next_deal_role, status, source_apply_id], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    applyFinish = true;
    if (recordFinish) {
      response.json({code:200, msg:'审核成功'})
    }
  })
  // 处理记录
  let deal_way = '审核';
  let deal_result = '通过';
  let sqlTwo = 'insert into deal_record values(null,?,?,NOW(),?,?,?)';
  pool.query(sqlTwo, [source_apply_id, deal_user, deal_way, deal_result,comment], (err, result) => {
    if (err) {
      response.json({code: 500, msg: '服务器错误'});
      throw err;
    }
    recordFinish = true;
    if (applyFinish) {
      return response.json({code:200, msg:'审核成功'})
    }
  })
})

/**
 * 拒绝申请表
 */
server.post('/apply/refuse', (request, response) => {
  let deal_user = request.session.name;
  let source_apply_id = request.body.id;
  let comment = request.body.comment;
  let status = '已拒绝';
  let next_deal_role = '主管';
  let applyFinish = false;
  let recordFinish = false;
  // 修改申请表状态
  let sqlOne = 'update source_apply set next_deal_role=?,status=? where id=?';
  pool.query(sqlOne, [next_deal_role,status,source_apply_id], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    applyFinish = true;
    if (recordFinish) {
      return response.json({code:200, msg:'审核成功'})
    }
  })
  // 处理记录
  let deal_way = '审核';
  let deal_result = '已拒绝';
  let sqlTwo = 'insert into deal_record values(null,?,?,NOW(),?,?,?)';
  pool.query(sqlTwo,[source_apply_id, deal_user, deal_way,deal_result,comment],(err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    recordFinish = true;
    if (applyFinish) {
      response.json({code:200, msg:'审核成功'})
    }
  })
})

/**
 * 查看待处理申请表
 */
server.get('/apply/todo', (request, response) => {
  let name = request.session.name;
  let type = request.session.type;
  let next_deal_role = (type !== 1) ? name : '管理员'

  let resData = {
    arr: null
  };
  let sql = 'SELECT s.id, s.source_name, s.cause, s.create_time, s.status, user.name FROM source_apply s,\ ' +
    'user where s.next_deal_role=? AND s.applier=user.name;';
  pool.query(sql, [next_deal_role], (err, result) => {
    if (err) {
      return response.json({code: 500, msg:'服务器错误'});
    }
    resData.arr = result;
    return response.json({code: 200, data: resData})
  })
})

/**
 * 查看个人申请表
 */
server.post('/apply/history', (request, response) => {
  let name = request.session.name;
  let resData = {arr:null};
  let sql = 'select id, source_name, cause, create_time, status from source_apply where applier=?';
  pool.query(sql, [name], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    resData.arr = result;
    return response.json(resData)
  })
})

/**
 * 查看申请表详细信息
 */
server.post('/apply/detail', (request, response) => {
  let source_apply_id = request.body.id;
  let resData = {
    info: null,
    detail: null,
    record: null
  };
  let applyFinish = false;
  let detailFinish = false;
  let recordFinish = false;
  // 获取基本信息
  let sqlOne = 'select * from source_apply where id=?';
  pool.query(sqlOne, [source_apply_id], (err, result) => {
    if (err) {
      throw err;
    }
    resData.info = result;
    applyFinish = true;
    if (detailFinish && recordFinish) {
      return response.json(resData)
    }
  })

  // 获取申请表详细内容
  let sqlTwo = 'select source_type, apply_date, apply_time, comment from source_apply_detail where source_apply_id=?';
  pool.query(sqlTwo, [source_apply_id], (err, result) => {
    if (err) {
      throw err;
    }
    resData.detail = result;
    detailFinish = true;
    if (applyFinish && recordFinish) {
      return response.json(resData)
    }
  })

  // 获取处理记录
  let sqlThree = 'select deal_user, deal_time, deal_way, deal_result, comment from deal_record where source_apply_id=?';
  pool.query(sqlThree, [source_apply_id], (err, result) => {
    if (err) {
      throw err;
    }
    resData.record = result;
    recordFinish = true;
    if (applyFinish && detailFinish) {
      return response.json(resData);
    }
  })
})

/**
 * 创建报修表
 */
server.post('/bug/create', (request, response) => {
  let params = request.body;
  let sourceName = params.sourceName;
  let sourceType = params.sourceType;
  let createTime = params.createTime;
  let bug = params.bug;
  let bugger = params.bugger;
  let status = '已报修';
  let deal_role = 1;
  if (!bug) {
    response.json({code:404, msg:'请描述故障情况'})
    return
  }
  let sqlOne = 'insert into bug_list values(null,?,?,?,?,?,?,?)';
  pool.query(sqlOne, [sourceName,sourceType,bug,bugger,createTime,status, deal_role], (err, result) => {
    if (err) {
      return response.json({code: 500, msg: '服务器错误'})
    }
    return response.json({code: 200, msg: '创建成功'})
  })
})

/**
 * 查看个人报修表
 */
server.post('/bug/list', (request, response) => {
  let name = request.session.name;
  let deal_role = 1;
  // let type = request.session.type;
  let sql = 'select * from bug_list where bugger=?'
  pool.query(sql, [name], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    if (result) {
      return response.json({code:200, data:result})
    }
  })
})

/**
 * 查看待处理报修表
 */
server.post('/bug/todo', (request, response) => {
  let type = request.session.type;
  let sql = 'select * from bug_list where deal_role=?';
  pool.query(sql, [type], (err, result) => {
    if (err) {
      response.json({code: 500, msg:'服务器错误'})
      throw err;
    }
    // console.log(result)
    if (result) {
      return response.json({code:200, data:result})
    }
  })
})

/**
 * 报修处理中
 */
server.post('/bug/handling', (request, response) => {
  let id = request.body.id;
  let status = '处理中';
  let deal_role = 1;
  let sql = 'update bug_list set status=?,deal_role=? where id=?';
  pool.query(sql, [status, deal_role, id], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'处理成功'})
    }
  })
})

/**
 * 完成报修处理
 */
server.post('/bug/handled', (request, response) => {
  let id = request.body.id;
  let status = '已处理';
  let deal_role = 0;
  let sql = 'update bug_list set status=?,deal_role=? where id=?';
  pool.query(sql, [status, deal_role, id], (err, result) => {
    if (err) {
      response.json({code:500, msg:'服务器错误'})
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'处理成功'})
    }
  })
})

/**
 * 获取所有评论
 */
server.post('/comment/all', (request, response) => {
  let resData = {
    comment: null,
    reply: null
  }
  let sqlOne = 'select * from comments_info';
  let commentFinish = false;
  let replyFinish = false;

  pool.query(sqlOne, [], (err, result) => {
    if (err) {
      throw err;
    }
    resData.comment = result;
    commentFinish = true;
    if (commentFinish && replyFinish) {
      // console.log(resData);
      return response.json({code: 200, data: resData});
    }
    // resData.forEach(item => {
    //   item['reply'] = []
    // })
  })
  // 获取子评论
  let sqlTwo = 'select * from comment_reply';
  pool.query(sqlTwo,[], (err, result) => {
    if (err) {
      throw err;
    }
    resData.reply = result;
    replyFinish = true;
    // console.log(reply);
    if (commentFinish && replyFinish) {
      // console.log(resData);
      return response.json({code: 200, data: resData});
    }
  })
})

/**
 * 添加新的评论
 */
server.post('/comment/new', (request, response) => {
  let params = request.body;
  let fromId = params.id;
  let fromName = request.session.name;
  let content = params.content;
  let fromAvatar = params.fromAvatar
  let likeNum = 0;
  let sql = 'insert into comments_info values(null,?,?,?,?,?,NOW())';
  pool.query(sql, [fromId,fromName,fromAvatar,likeNum,content], (err, result) => {
    if (err) {
      response.json({code:500, mag:'服务器错误'});
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'评论成功'})
    }
  })
})

/**
 * 回复评论
 */
server.post('/comment/reply', (request, response) => {
  let params = request.body;
  let fromName = request.session.name;
  let fromId = params.fromId;
  let commentId = params.commentId;
  let fromAvatar = params.fromAvatar;
  let toId = params.toId;
  let toName = params.toName;
  let toAvatar = params.toAvatar;
  let content = params.content;
  let sql = 'insert into comment_reply values(null,?,?,?,?,?,?,?,?,NOW())'
  pool.query(sql, [commentId,fromId,fromName,fromAvatar,toId,toName,toAvatar,content], (err, result) => {
    if (err) {
      response.json({code: 200, msg: '服务器错误'});
      throw err;
    }
    if (result) {
      return response.json({code:200, msg: '回复成功'});
    }
  })
})

/**
 * 点赞
 */
server.post('/comment/like', (request, response) => {
  let params = request.body;
  let id = params.id;
  let likeNum = params.likeNum;
  let sql = 'update comments_info set like_num=? where id=?';
  pool.query(sql, [likeNum, id], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'更新成功'})
    }
  })
})

/**
 * 修改密码
 */
server.post('/password', (request, response) => {
  let name = request.session.name;
  let password = request.body.password;
  let newPassword = request.body.newPassword;
  let sqlOne = 'select * from user where name=? and password=?'
  pool.query(sqlOne, [name, password], (err, result) => {
    if (err) {
      throw err;
    }
    if (result.length > 0) {
      let sqlTwo = 'update user set password=? where name=?';
      pool.query(sqlTwo, [newPassword, name], (err, result) => {
        if (err) {
          throw err;
        } else {
          return response.json({code:200, msg:'修改成功'})
        }
      })
    } else {
      return response.json({code:401, msg:'原密码错误'})
    }
  })
})

/**
 * 新建文章
 */
server.post('/article/add', (request, response) => {
  let name = request.session.name;
  let params = request.body;
  let title = params.title;
  let summary = params.summary;
  let content = params.content;
  let comment = params.comment;
  let state = 1;
  let sql = 'insert into article values(null,?,?,?,?,?,NOW(),NOW(),?)';
  pool.query(sql, [title,summary,content,comment,name,state], (err, result) => {
    if (err) {
      throw err
    }
    if (result) {
      return response.json({code:200, msg:'创建成功'})
    }
  })
})

/**
 * 查询文章
 */
server.post('/article/search', (request, response) => {
  let params = request.body;
  let pageNum = params.pageNum;
  let pageSize = params.pageSize ? params.pageSize : 10;
  let offsetPage = (pageNum-1)*pageSize;
  let searchId = params.searchId;
  let searchTitle = params.searchName;
  let searchAuthor = params.searchAuthor;

  let sqlSelectTotal = 'select count(*) as totalCount from article where state=1';
  let sqlSelectList = 'select id,title,content,comment,author,create_time, update_time from article where state=1'
  if (searchId) {
    sqlSelectTotal += " and id = "+searchId;
    sqlSelectList += " and id = "+searchId;
  }
  if (searchTitle) {
    sqlSelectTotal += " and title = '"+searchTitle+"'" ;
    sqlSelectList += " and title = '"+searchTitle+"'";
  }
  if (searchAuthor) {
    sqlSelectTotal += " and author = '"+searchAuthor+"'" ;
    sqlSelectList += " and author = '"+searchAuthor+"'";
  }
  let sql = sqlSelectTotal + ';' + sqlSelectList;
  sql += ' order by id desc limit ? offset ?';
  pool.query(sql, [pageSize, offsetPage], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      let resData = {};
      resData.totalCount = result[0][0]['totalCount'];
      resData.list = result[1];
      return response.json({code:200, msg: '获取成功', data: resData})
    } else {
      return response.json({code: 404, message: '不存在你搜索的资源'})
    }
  })
})

/**
 * 根据id值获取文章详细信息
 */
server.post('/article/detail', (request, response) => {
  let id = request.body.id;
  let sql = 'select * from article where id=?';
  pool.query(sql, [id], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      // console.log(result[0])
      return response.json({code:200, data: result[0]})
    }
  })
})

/**
 * 更新文章
 */
server.post('/article/update', (request, response) => {
  let params = request.body;
  let id = params.id;
  let title = params.title;
  let summary = params.summary;
  let content = params.content;
  let comment = params.comment;
  let sql = 'update article set title=?, summary=?,content=?,comment=?,update_time=NOW() where id=?';
  pool.query(sql, [title, summary, content, comment, id], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      return response.json({code:200, msg: '更新成功'})
    }
  })
})

/**
 * 删除文章公告
 */
server.post('/article/delete', (request, response) => {
  let id = request.body.id;
  let sql = 'delete from article where id=?';
  pool.query(sql, [id], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'删除成功'})
    }
  })
})

/**
 * 根据创作者获取文章公告
 */
server.post('/article/mine', (request, response) => {
  let name = request.session.name;
  let params = request.body;
  let pageNum = params.pageNum;
  let pageSize = params.pageSize ? params.pageSize : 10;
  let offsetPage = (pageNum-1)*pageSize;
  if (!name) {
    return response.json({code:401, msg:'请先登录'})
  }
  let sqlSelectTotal = 'select count(*) as totalCount from article where state=1 and author=?';
  let sqlSelectList = 'select id,title,content,comment,author,create_time, update_time from article where state=1 and author=?'
  let sql = sqlSelectTotal + ';' + sqlSelectList;
  sql += ' order by id desc limit ? offset ?';
  pool.query(sql, [name, name, pageSize, offsetPage], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      let resData = {};
      resData.totalCount = result[0][0]['totalCount'];
      resData.list = result[1];
      return response.json({code:200, msg: '获取成功', data: resData})
    }
  })
})

/**
 * 获取用户列表
 */
server.post('/user/list', (req, res) => {
  let params = req.body;
  let pageNum = params.pageNum
  let pageSize = params.pageSize ? params.pageSize : 10;
  let offsetPage = (pageNum - 1)*pageSize;
  let searchId = params.searchId;

  let searchName = params.searchName;
  let searchEmail = params.searchEmail;
  let sqlSelectTotal = 'select count(*) as totalCount from user where state = 1 ';
  let sqlSelectList = 'select id,name,type,email,create_time,update_time from user where state = 1 ';
  if (searchId) {
    sqlSelectTotal += " and id = "+searchId;
    sqlSelectList += " and id = "+searchId;
  }
  if (searchName) {
    sqlSelectTotal += " and source_name = '"+searchName+"'" ;
    sqlSelectList += " and source_name = '"+searchName+"'";
  }
  if (searchEmail) {
    sqlSelectTotal += " and source_type = '"+searchEmail+"'";
    sqlSelectList += " and source_type = '"+searchEmail+"'";
  }
  let sql = sqlSelectTotal + ';' + sqlSelectList;
  sql += ' order by id limit ? offset ? ';
  pool.query(sql,[pageSize,offsetPage],(err, result) => {
    if (err) {
      throw err
    }
    if (result) {
      let resData = {};
      resData.totalCount = result[0][0]['totalCount'];
      resData.list = result[1];
      res.json({code: 200, data: resData, message: '获取列表成功'})
    } else {
      res.json({code: 404, message: '不存在该资源'})
    }
  })
})

/**
 * 新增管理员
 */
server.post('/admin/new', (request, response) => {
  let params = request.body;
  let name = params.name;
  let pwd = params.password;
  let email = params.email;
  let type = 1;
  let state = 1;
  let sql = 'insert into user values(null,?,?,?,?,NOW(),NOW(),?)';
  pool.query(sql, [name, pwd, email, type, state], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'添加成功'})
    } else {
      return response.json({code:500, msg:'服务器错误'})
    }
  })
})

/**
 * 分配角色
 */
server.post('/user/role', (request, response) => {
  let id = request.body.id;
  let email = request.body.email;
  let type = 1;
  let sql = 'update user set email=?, type=?, update_time=NOW() where id=?';
  pool.query(sql, [email, type,id], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'分配成功'})
    } else {
      return response.json({code:500, msg:'未知错误'})
    }
  })
})

/**
 * 根据id 删除用户
 */
server.post('/user/delete', (request, response) => {
  let id = request.body.id;
  let sql = 'delete from user where id=?';
  pool.query(sql, [id], (err, result) => {
    if (err) {
      throw err;
    }
    if (result) {
      return response.json({code:200, msg:'删除成功'})
    } else {
      return response.json({code:500, msg:'服务器错误'})
    }
  })
})










