"use client";

import { useState, useEffect } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BouncyClick from "@/components/ui/bouncy-click";
import { AuthDialog } from "@/components/auth-dialog";
import { LogIn, Menu, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  retract,
  normalize,
  transition_fast,
  fade_out_scale_1,
  fade_out,
} from "@/lib/transitions";
import { ME_QUERY } from "@/lib/graphql/queries";

const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

function NavbarContent() {
  const { data, refetch, loading } = useQuery(ME_QUERY);
  const [logout] = useMutation(LOGOUT_MUTATION);
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const user = data?.me;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth-token");
        document.cookie =
          "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax";
      }
      await refetch();
      router.push("/");
      toast.success("Logged out successfully.");
    } catch {
      toast.error("Failed to log out.");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="border-b h-16 bg-background">
      <div className="container mx-auto px-4 h-full">
        <div className="flex h-full items-center justify-between">
          <div className="hidden md:flex items-center space-x-6">
            <BouncyClick noRipple>
              <Link href="/" className="text-xl font-bold">
                EP Games
              </Link>
            </BouncyClick>
            <BouncyClick>
              <Button asChild variant="ghost">
                <Link href="/games" className="hover:text-primary">
                  Browse
                </Link>
              </Button>
            </BouncyClick>
            <BouncyClick>
              <Button asChild variant="ghost">
                <Link href="/create" className="hover:text-primary">
                  Create
                </Link>
              </Button>
            </BouncyClick>
          </div>

          <div className="md:hidden flex items-center space-x-4">
            <BouncyClick noRipple>
              <Link href="/" className="text-xl font-bold">
                EP Games
              </Link>
            </BouncyClick>
          </div>

          <div className="flex items-center space-x-2">
            <BouncyClick>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {!mounted ? (
                  <span className="h-5 w-5 block" aria-hidden />
                ) : (
                  <AnimatePresence mode="wait">
                    {theme === "dark" ? (
                      <motion.span
                        key="sun"
                        initial={fade_out}
                        animate={normalize}
                        exit={fade_out_scale_1}
                        transition={transition_fast}
                      >
                        <Sun className="h-5 w-5" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="moon"
                        initial={fade_out}
                        animate={normalize}
                        exit={fade_out_scale_1}
                        transition={transition_fast}
                      >
                        <Moon className="h-5 w-5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                )}
              </Button>
            </BouncyClick>

            <div className="md:hidden">
              <BouncyClick>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </BouncyClick>
            </div>

            {loading ? (
              <div className="w-10" />
            ) : (
              <AnimatePresence mode="wait">
                {user ? (
                  <motion.div
                    key="user"
                    initial={fade_out}
                    animate={normalize}
                    exit={fade_out_scale_1}
                    transition={transition_fast}
                  >
                    <DropdownMenu>
                      <BouncyClick>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="relative h-10 w-10 rounded-full"
                          >
                            <Avatar>
                              {user.avatar && (
                                <AvatarImage
                                  src={user.avatar}
                                  alt={user.username}
                                />
                              )}
                              <AvatarFallback>
                                {user.username[0]?.toUpperCase() ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                          </Button>
                        </DropdownMenuTrigger>
                      </BouncyClick>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/users/${user.id}`}>Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={handleLogout}
                        >
                          Logout
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                ) : (
                  <motion.div
                    key="login"
                    initial={fade_out}
                    animate={normalize}
                    exit={fade_out_scale_1}
                    transition={transition_fast}
                  >
                    <AuthDialog onSuccess={() => refetch()}>
                      <Button variant="ghost">
                        <LogIn className="h-4 w-4 mr-2" />
                        Login / Register
                      </Button>
                    </AuthDialog>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mobileMenuOpen && (
            <motion.div
              initial={retract}
              animate={{ ...normalize, height: "auto" }}
              exit={retract}
              transition={transition_fast}
              className="md:hidden border-t bg-background overflow-hidden"
              key="mobile-menu"
            >
              <div className="px-4 py-2 space-y-1">
                <BouncyClick>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link
                      href="/games"
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-primary"
                    >
                      Browse
                    </Link>
                  </Button>
                </BouncyClick>
                <BouncyClick>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link
                      href="/create"
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-primary"
                    >
                      Create
                    </Link>
                  </Button>
                </BouncyClick>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

export function Navbar() {
  return <NavbarContent />;
}
export { ME_QUERY };
