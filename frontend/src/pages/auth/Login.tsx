import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符"),
  password: z.string().min(6, "密码至少6个字符"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("登录失败");
      }

      const data = await response.json();
      login(data.user, data.access_token);
      toast.success("登录成功");
      navigate("/dashboard");
    } catch {
      toast.error("用户名或密码错误");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
      {/* 动态背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* 径向发光节点 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* 背景网格纹理 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* 登录卡片 - 毛玻璃质感 */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-700">
        <Card className="p-10!">
          <CardHeader className="space-y-1 text-center px-6 sm:px-10 pt-10 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                B-DataGov Lite
              </span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              数据治理与可视化平台
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-slate-300 text-xs font-medium uppercase tracking-wider">
                        用户名
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入用户名"
                          autoComplete="username"
                          className="h-10 px-2! bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500/50 transition-all rounded-lg"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-slate-300 text-xs font-medium uppercase tracking-wider">
                        密码
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="请输入密码"
                          autoComplete="current-password"
                          className="h-10 px-2! bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500/50 transition-all rounded-lg"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] rounded-lg mt-8! mb-6!"
                >
                  登录
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-xs text-slate-500">
              没有账号？{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
                立即注册
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
