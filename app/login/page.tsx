"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "unauthorized") {
        setError("您的账号没有权限访问该日程表");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await Promise.race([
        signIn("credentials", {
          email,
          password,
          redirect: false,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 8000)
        ),
      ]);

      if (res?.error) {
        setError("邮箱或密码错误");
      } else {
        router.push("/");
        router.refresh();
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.message === "TIMEOUT") {
        setError("服务器响应超时，请检查 Vercel 环境变量 AUTH_SECRET 是否配置正确");
      } else {
        setError("登录异常，请检查 Vercel Function Logs 中的 /api/auth/callback/credentials 报错");
      }
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f3f0",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          borderRadius: 20,
          padding: "32px 28px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: 8, color: "#3d3d3d" }}>
          饶 & 李 的日程对照表
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#888",
            marginBottom: 28,
            fontSize: 14,
          }}
        >
          登录后继续
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#666",
                marginBottom: 6,
              }}
            >
              邮箱
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d0ccc5",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#666",
                marginBottom: 6,
              }}
            >
              密码
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d0ccc5",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div
              style={{
                color: "#c97b7b",
                fontSize: 13,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 14,
              border: "none",
              background: "#8b7d6b",
              color: "#fff",
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        {/* <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 13,
            color: "#666",
          }}
        >
          还没有账号？ <Link href="/register" style={{ color: "#8b7d6b" }}>去注册</Link>
        </div> */}
      </div>
    </div>
  );
}
