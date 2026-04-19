import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Radio,
  UserCog,
  Database,
  Upload,
  GitBranch,
  Shield,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSidebarStore } from "./sidebar-store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// 导航项配置
const NAV_ITEMS = [
  { path: "/", label: "全网态势总览", icon: LayoutDashboard },
  { path: "/bilibili", label: "B站监控", icon: Radio },
  { path: "/douyu", label: "斗鱼监控", icon: Radio },
  { path: "/catalog", label: "资产目录", icon: Database },
  { path: "/ingestion", label: "数据采集", icon: Upload },
  { path: "/quality", label: "质量监控", icon: Shield },
  { path: "/lineage", label: "数据血缘", icon: GitBranch },
  { path: "/roi", label: "治理成效", icon: BarChart3 },
  // { path: "/admin", label: "管理后台", icon: UserCog },
];

export function Sidebar() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { sidebarExpand, setSidebarExpand } = useSidebarStore();
  const expanded = sidebarExpand === "expand";

  // 从 localStorage 恢复状态
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expand");
    if (saved === "expand" || saved === "collapse") {
      setSidebarExpand(saved);
    }
  }, [setSidebarExpand]);

  // 保存状态
  useEffect(() => {
    localStorage.setItem("sidebar-expand", sidebarExpand);
  }, [sidebarExpand]);

  // 键盘快捷键: Ctrl+B
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        setSidebarExpand(sidebarExpand === "expand" ? "collapse" : "expand");
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [sidebarExpand, setSidebarExpand]);

  const handleToggle = () => {
    setSidebarExpand(sidebarExpand === "expand" ? "collapse" : "expand");
  };

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-background transition-all duration-300",
        expanded ? "w-[240px]" : "w-16",
      )}
    >
      {/* Logo 区域 */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b transition-all",
          expanded ? "px-4" : "justify-center px-0",
        )}
      >
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-primary" />
          </div>
          {expanded && (
            <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500 truncate">
              B-DataGov
            </span>
          )}
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-y-1.5 py-4 overflow-y-auto scrollbar-hide",
          expanded ? "px-3" : "px-2",
        )}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "group flex items-center gap-3 rounded-xl p-3! text-sm font-medium transition-all duration-200 border",
                isActive
                  ? "bg-primary/10 border-primary/20 text-primary shadow-sm" // 真实的激活态：带主题色背景、边框和阴影
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm", // 真实的悬浮态：灰色背景浮现
              )}
              title={!expanded ? item.label : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {expanded && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 底部区域 */}
      <div className="border-t bg-background/50 backdrop-blur-sm pb-2">
        {/* 用户菜单 */}
        {/* <div className={cn("flex items-center", expanded ? "px-3 py-2" : "justify-center py-2")}> */}
        {/*   <DropdownMenu> */}
        {/*     <DropdownMenuTrigger asChild> */}
        {/*       <Button */}
        {/*         variant="ghost" */}
        {/*         className={cn( */}
        {/*           "h-12 w-full transition-all hover:bg-muted rounded-xl", */}
        {/*           expanded ? "justify-start px-3 gap-3" : "justify-center px-0", */}
        {/*         )} */}
        {/*       > */}
        {/*         <Avatar className="w-8 h-8 shrink-0 border border-border"> */}
        {/*           <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs"> */}
        {/*             {user?.nickname?.[0]?.toUpperCase() || "U"} */}
        {/*           </AvatarFallback> */}
        {/*         </Avatar> */}
        {/*         {expanded && ( */}
        {/*           <div className="flex flex-col items-start overflow-hidden"> */}
        {/*             <span className="text-sm font-medium truncate w-full text-foreground"> */}
        {/*               {user?.nickname || "System Admin"} */}
        {/*             </span> */}
        {/*             <span className="text-xs text-muted-foreground truncate w-full"> */}
        {/*               Data Engineer */}
        {/*             </span> */}
        {/*           </div> */}
        {/*         )} */}
        {/*       </Button> */}
        {/*     </DropdownMenuTrigger> */}
        {/*     <DropdownMenuContent align="end" className="w-48"> */}
        {/*       <DropdownMenuItem */}
        {/*         onClick={logout} */}
        {/*         className="text-red-500 focus:text-red-500 cursor-pointer" */}
        {/*       > */}
        {/*         <UserCog className="w-4 h-4 mr-2" /> */}
        {/*         退出登录 */}
        {/*       </DropdownMenuItem> */}
        {/*     </DropdownMenuContent> */}
        {/*   </DropdownMenu> */}
        {/* </div> */}
        {/**/}
        {/* 收起/展开按钮 */}
        <div className={cn("flex items-center", expanded ? "px-3" : "justify-center")}>
          <Button
            variant="ghost"
            onClick={handleToggle}
            className={cn(
              "h-10 w-full transition-all hover:bg-muted rounded-xl text-muted-foreground",
              expanded ? "justify-start px-3 gap-2" : "justify-center px-0",
            )}
          >
            {expanded ? (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm font-medium">收起面板</span>
              </>
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
