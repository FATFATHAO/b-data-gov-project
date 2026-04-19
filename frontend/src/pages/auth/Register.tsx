import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
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

const registerSchema = z
  .object({
    username: z.string().min(2, "用户名至少2个字符"),
    nickname: z.string().min(2, "昵称至少2个字符"),
    password: z.string().min(6, "密码至少6个字符"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      nickname: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          nickname: values.nickname,
          password: values.password,
        }),
      });

      if (!response.ok) {
        throw new Error("注册失败");
      }

      toast.success("注册成功，请登录");
      navigate("/login");
    } catch {
      toast.error("注册失败，请稍后重试");
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

      {/* 注册卡片 - 毛玻璃质感 */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-700">
        <Card className="p-10!">
          <CardHeader className="space-y-1 text-center px-8 pt-8 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                创建账号
              </span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              加入 B-DataGov Lite 平台
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  name="nickname"
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-slate-300 text-xs font-medium uppercase tracking-wider">
                        昵称
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入昵称"
                          autoComplete="nickname"
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
                          autoComplete="new-password"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-slate-300 text-xs font-medium uppercase tracking-wider">
                        确认密码
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="请确认密码"
                          autoComplete="new-password"
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
                  注册
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-xs text-slate-500">
              已有账号？{" "}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                返回登录
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
