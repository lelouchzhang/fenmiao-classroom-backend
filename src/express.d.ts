// 为每个请求声明user.role属性
declare global {
  namespace Express {
    interface Request {
      user?: {
        role?: "admin" | "teacher" | "student";
      };
    }
  }
}

export {};
