import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export function Signup() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    badgeNumber: "",
    name: "",
    dateOfBirth: "",
    password: "",
    passwordConfirm: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검사
    if (!formData.badgeNumber.trim()) {
      toast.error("회사 명찰 번호를 입력해주세요.");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (!formData.dateOfBirth) {
      toast.error("생년월일을 입력해주세요.");
      return;
    }
    if (!formData.password) {
      toast.error("비밀번호를 입력해주세요.");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);

    try {
      // 회원가입 API 호출
      const response = await fetch("/api/trpc/auth.signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: {
            badgeNumber: formData.badgeNumber.trim(),
            name: formData.name.trim(),
            dateOfBirth: formData.dateOfBirth,
            password: formData.password,
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.error) {
        const message = payload?.error?.json?.message ?? payload?.error?.message;
        throw new Error(message || "회원가입 실패");
      }

      toast.success("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
      
      // 로그인 페이지로 이동
      setTimeout(() => {
        setLocation("/login");
      }, 1500);
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error instanceof Error ? error.message : "회원가입 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-2xl">
        <div className="p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">⚙️</span>
              </div>
              <h1 className="text-2xl font-bold text-white">SemiGuard AI</h1>
            </div>
            <p className="text-slate-400 text-sm">반도체 장비 예지안전 시스템</p>
          </div>

          {/* 회원가입 폼 */}
          <form onSubmit={handleSignup} className="space-y-5">
            {/* 회사 명찰 번호 */}
            <div className="space-y-2">
              <Label htmlFor="badgeNumber" className="text-slate-300 text-sm font-medium">
                회사 명찰 번호
              </Label>
              <Input
                id="badgeNumber"
                name="badgeNumber"
                type="text"
                placeholder="예: EMP-2024-001"
                value={formData.badgeNumber}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400"
                disabled={isLoading}
              />
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300 text-sm font-medium">
                이름
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="예: 홍길동"
                value={formData.name}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400"
                disabled={isLoading}
              />
            </div>

            {/* 생년월일 */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-slate-300 text-sm font-medium">
                생년월일
              </Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400"
                disabled={isLoading}
              />
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                비밀번호
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="6자 이상"
                value={formData.password}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400"
                disabled={isLoading}
              />
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" className="text-slate-300 text-sm font-medium">
                비밀번호 확인
              </Label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                placeholder="비밀번호 재입력"
                value={formData.passwordConfirm}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400"
                disabled={isLoading}
              />
            </div>

            {/* 회원가입 버튼 */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "처리 중..." : "회원가입"}
            </Button>
          </form>

          {/* 로그인 링크 */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              이미 계정이 있으신가요?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                로그인
              </button>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Signup;
