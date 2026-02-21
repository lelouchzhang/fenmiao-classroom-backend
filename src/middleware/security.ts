import type { Request, Response, NextFunction } from "express";
import aj from "../config/arcjet";
import { ArcjetNodeRequest, slidingWindow } from "@arcjet/node";

const securityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 测试环境跳过检查
  if (process.env.NODE_ENV === "development") {
    return next();
  }

  try {
    const role: RateLimitRole = req.user?.role ?? "guest";
    let limit: number;
    let message: string;
    switch (role) {
      case "admin":
        limit = 20;
        message = "管理员用户请求速率为每分钟20次. Slow Down!";
        break;
      case "teacher":
      case "student":
        limit = 10;
        message = "超过注册用户的安全请求速率:每分钟10次,清稍等";
        break;
      default:
        limit = 5;
        message = "游客用户限制每分钟5次网络请求,注册后可获得更好体验.";
        break;
    }
    const client = aj.withRule(
      slidingWindow({
        mode: "LIVE",
        interval: "1m",
        max: limit,
      })
    );
    const arkjectRequest: ArcjetNodeRequest = {
      headers: req.headers,
      method: req.method,
      url: req.originalUrl ?? req.url,
      socket: {
        remoteAddress: req.socket.remoteAddress ?? req.ip ?? "0.0.0.0",
      },
    };

    const decision = await client.protect(arkjectRequest);

    if (decision.isDenied() && decision.reason.isBot()) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Automatic requests are not allowed",
      });
    }
    if (decision.isDenied() && decision.reason.isRateLimit()) {
      return res.status(429).json({
        error: "请求速率限制",
        message,
      });
    }
    if (decision.isDenied() && decision.reason.isShield()) {
      return res.status(403).json({
        error: "Forbidden",
        message: "请求被网站安全策略阻止",
      });
    }
    next();
  } catch (error) {
    console.error("Arcjet 中间件发生错误：", error);
    res.status(500).json({
      error: "服务器错误",
      message: "Arcjet 中间件发生错误，请稍后再试或联系管理员",
    });
  }
};

export default securityMiddleware;
