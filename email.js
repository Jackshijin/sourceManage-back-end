// redis和发送邮件配置
export default {
  redis: {
    get host () {
      return '127.0.0.1'
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