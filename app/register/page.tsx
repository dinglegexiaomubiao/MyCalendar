"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, inviteCode: inviteCode || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "注册失败");
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    }
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
          创建账号
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#888",
            marginBottom: 28,
            fontSize: 14,
          }}
        >
          注册后即可使用日程对照表
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}>
              昵称
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d0ccc5",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="怎么称呼你"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}>
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

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}>
              密码
            </label>
            <input
              type="password"
              required
              minLength={6}
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
              placeholder="至少6位字符"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}>
              邀请码（可选）
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d0ccc5",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="有邀请码可直接加入对方的日历"
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

          {success && (
            <div
              style={{
                color: "#2d5a4e",
                fontSize: 13,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              注册成功，即将跳转登录...
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 14,
              border: "none",
              background: "#8b7d6b",
              color: "#fff",
              fontSize: 15,
              cursor: loading || success ? "not-allowed" : "pointer",
              opacity: loading || success ? 0.7 : 1,
            }}
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 13,
            color: "#666",
          }}
        >
          已有账号？ <Link href="/login" style={{ color: "#8b7d6b" }}>去登录</Link>
        </div>
      </div>
    </div>
  );
}
