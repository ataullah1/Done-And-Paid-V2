"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/src/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/components/ui/collapsible";
import {
  Bell,
  ChevronRight,
  ChevronsUpDown,
  CircleUserRound,
  GalleryVerticalEnd,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { ExitIcon } from "@radix-ui/react-icons";
import { useCurrentUser } from "@/src/hooks/use-current-user";
import { navItems } from "@/src/components/constants/data";
import { Icons } from "@/src/components/icons";
import logoImg from "../../../../public/logo-icon.svg";
import { LogoutButton } from "@/src/components/auth/logout-button";
import React from "react";
import { useSession } from "next-auth/react";
import { BusinessType, UserRole } from "@prisma/client";
import { Skeleton } from "@/src/components/ui/skeleton";
import Image from "next/image";

export const company = {
  name: "Done And Paid",
  logo: logoImg,
  plan: "Administrator",
};

export function AppSidebar() {
  const { data: session, status } = useSession();
  const user = useCurrentUser();
  const pathname = usePathname();
  const isLoading = status === "loading";

  // Use session role directly for faster initial render
  const filteredNavItems = React.useMemo(() => {
    if (!session?.user?.role) return [];
    return navItems.filter((item) => {
      // Check role permissions
      if (
        item.allowedRoles &&
        !item.allowedRoles.includes(session.user.role as UserRole)
      ) {
        return false;
      }
      // Check business type permissions
      if (item.allowedBusinessTypes && session.user.businessType) {
        return item.allowedBusinessTypes.includes(
          session.user.businessType as BusinessType
        );
      }
      // Show items without business type restrictions to all users
      return (
        !item.allowedBusinessTypes || item.allowedBusinessTypes.length === 0
      );
    });
  }, [session?.user?.role, session?.user?.businessType]);

  const renderSkeletonItem = () => (
    <SidebarMenuItem>
      <div className="flex items-center gap-3 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
    </SidebarMenuItem>
  );

  const sidebarLinks = [
    ...filteredNavItems.map((item) => {
      const Icon = item.icon ? Icons[item.icon] : Icons.logo;
      return item?.items && item?.items?.length > 0 ? (
        <Collapsible
          key={item.title}
          asChild
          defaultOpen={item.items?.some((subItem) =>
            pathname.startsWith(subItem.url || "")
          )}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                tooltip={item.disabled ? "Coming Soon" : item.title}
                isActive={
                  pathname === item.url ||
                  (item.items &&
                    item.items.some((subItem) => pathname === subItem.url))
                }
                className={item.disabled ? "opacity-50 cursor-not-allowed" : ""}
              >
                {item.icon && <Icon />}
                {item.url ? (
                  <Link href={item.url || "/"}>
                    <span>{item.title}</span>
                  </Link>
                ) : (
                  <span>{item.title}</span>
                )}

                {item.disabled && (
                  <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4 animate-pulse" />
                  </div>
                )}
                {!item.disabled && (
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            {!item.disabled && (
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        asChild={!subItem.disabled}
                        isActive={
                          pathname === subItem.url ||
                          pathname.startsWith(subItem.url + "/")
                        }
                        className={
                          subItem.disabled
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }
                      >
                        {subItem.disabled ? (
                          <div
                            className="flex justify-between w-full items-center"
                            title="This feature is coming soon"
                          >
                            <span>{subItem.title}</span>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4 animate-pulse" />
                            </div>
                          </div>
                        ) : (
                          <Link href={subItem.url || "/"}>
                            <span>{subItem.title}</span>
                          </Link>
                        )}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            )}
          </SidebarMenuItem>
        </Collapsible>
      ) : (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            tooltip={item.title}
            isActive={pathname === item.url}
          >
            <Link href={item.url || "/"}>
              <Icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }),
  ];

  return (
    <Sidebar collapsible="icon" className="z-50">
      <SidebarHeader>
        <div className="flex gap-2 py-2 text-sidebar-accent-foreground">
          <div className="">
            <Image
              src={company.logo}
              className="h-8 w-auto"
              alt="Company Logo"
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{company.name}</span>
            <span className="truncate text-xs">{company.plan}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            {isLoading ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <React.Fragment key={index}>
                    {renderSkeletonItem()}
                  </React.Fragment>
                ))}
              </>
            ) : (
              sidebarLinks
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user?.image as string}
                      alt={user?.name as string}
                    />
                    <AvatarFallback className="rounded-lg">
                      {user?.name?.slice(0, 2)?.toUpperCase() || "CN"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name || ""}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email || ""}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user?.image || ""}
                        alt={user?.name || ""}
                      />
                      <AvatarFallback className="rounded-lg font-bold">
                        {user?.name?.slice(0, 2)?.toUpperCase() || "CN"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name || ""}
                      </span>
                      <span className="truncate text-xs">
                        {" "}
                        {user?.email || ""}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Link href={"/dashboard"} className="flex flex-row gap-2">
                      <Bell />
                      Notifications
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link
                      href={"/dashboard/settings"}
                      className="flex flex-row gap-2"
                    >
                      <CircleUserRound />
                      Account
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuItem>
                  <LogoutButton>
                    <div className="flex items-center gap-2">
                      <ExitIcon className="h-5 w-5" />
                      Logout
                    </div>
                  </LogoutButton>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
