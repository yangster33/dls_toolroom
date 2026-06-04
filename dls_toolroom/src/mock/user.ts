// Mock 接口示例

// GET 请求示例
export default [
  {
    // 接口路径
    url: '/api/user',
    // 请求方式
    method: 'get',
    // 响应数据
    response: () => {
      return {
        code: 0,
        data: [
          { id: 1, name: '张三', age: 18 },
          { id: 2, name: '李四', age: 20 },
        ],
      }
    },
  },
  {
    url: '/api/user/:id',
    method: 'get',
    response: (opts: { params: { id: string } }) => {
      return {
        code: 0,
        data: { id: opts.params.id, name: '用户' + opts.params.id },
      }
    },
  },

  // POST 请求示例
  {
    url: '/api/login',
    method: 'post',
    response: (body: { username: string; password: string }) => {
      if (body.username === 'admin' && body.password === '123456') {
        return {
          code: 0,
          data: { token: 'mock-token-12345', username: 'admin' },
        }
      }
      return {
        code: 401,
        message: '用户名或密码错误',
      }
    },
  },

  // 模拟延迟
  {
    url: '/api/delay',
    method: 'get',
    response: () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ code: 0, data: '延迟响应' })
        }, 1000)
      })
    },
  },
]
