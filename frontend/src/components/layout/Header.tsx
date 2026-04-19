import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useSidebarStore } from "./sidebar-store";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebarStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="flex items-center h-14 px-4 border-b"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="mr-4"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" className="gap-2 pr-4!">
            <Avatar className="w-8 h-8">
              <AvatarFallback>{user?.nickname?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user?.nickname || "用户"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Link to="/profile">个人中心</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
