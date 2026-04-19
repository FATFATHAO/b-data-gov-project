import { create } from "zustand";

type SidebarExpand = "expand" | "collapse";

type State = {
  sidebarExpand: SidebarExpand;
};

type Action = {
  setSidebarExpand: (state: SidebarExpand) => void;
  toggleSidebar: () => void;
};

export const useSidebarStore = create<State & Action>((set) => ({
  sidebarExpand: "expand",
  setSidebarExpand: (sidebarExpand) => set(() => ({ sidebarExpand })),
  toggleSidebar: () =>
    set((state) => ({
      sidebarExpand: state.sidebarExpand === "expand" ? "collapse" : "expand",
    })),
}));
