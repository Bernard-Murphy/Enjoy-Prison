"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { gql, useMutation, useLazyQuery } from "@apollo/client";
import { ME_QUERY } from "@/lib/graphql/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  normalize,
  fade_out,
  transition_fast,
  fade_out_scale_1,
} from "@/lib/transitions";
import BouncyClick from "@/components/ui/bouncy-click";
import Spinner from "@/components/ui/spinner";
import { getRecaptchaToken } from "@/lib/recaptcha-client";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      ),
    displayName: z.string().min(1, "Display name is required").max(30, "Display name at most 30 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(4, "Password must be at least 4 characters"),
    confirmPassword: z.string(),
    bio: z.string().max(10000).optional(),
    avatar: z.string().max(500).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const forgotPasswordSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Please enter a valid email address"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      success
      message
      user {
        id
        username
      }
      token
    }
  }
`;

const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!, $recaptchaToken: String) {
    register(input: $input, recaptchaToken: $recaptchaToken) {
      success
      message
      user {
        id
        username
      }
      token
    }
  }
`;

const REQUEST_PASSWORD_RESET_MUTATION = gql`
  mutation RequestPasswordReset($email: String!, $username: String!) {
    requestPasswordReset(email: $email, username: $username)
  }
`;

interface AuthDialogProps {
  children?: React.ReactNode;
  defaultTab?: "login" | "register" | "forgot";
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCancel?: () => void;
}

function AuthDialogContent({
  children,
  defaultTab = "login",
  onSuccess,
  open: externalOpen,
  onOpenChange,
  onCancel,
}: AuthDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      bio: "",
      avatar: "",
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { username: "", email: "" },
  });

  const [login] = useMutation(LOGIN_MUTATION);
  const [register] = useMutation(REGISTER_MUTATION);
  const [requestPasswordReset] = useMutation(REQUEST_PASSWORD_RESET_MUTATION);
  const [refetchMe] = useLazyQuery(ME_QUERY);

  const saveAuthToken = (token: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("auth-token", token);
    document.cookie = `auth-token=${token}; path=/; max-age=2592000; samesite=lax${process.env.NODE_ENV === "production" ? "; secure" : ""
      }`;
  };

  const handleLogin = async (data: LoginForm) => {
    try {
      const { data: response } = await login({
        variables: { username: data.username, password: data.password },
      });
      if (response?.login?.success) {
        toast.success("Logged in successfully.");
        if (response.login.token) saveAuthToken(response.login.token);
        await refetchMe();
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(response?.login?.message ?? "Invalid credentials.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed.");
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    try {
      const recaptchaToken = await getRecaptchaToken("register");
      const { data: response } = await register({
        variables: {
          input: {
            username: data.username,
            displayName: data.displayName,
            email: data.email,
            password: data.password,
            bio: data.bio || undefined,
            avatar: data.avatar?.trim() || undefined,
          },
          recaptchaToken: recaptchaToken ?? undefined,
        },
      });
      if (response?.register?.success) {
        toast.success("Account created. You are now logged in.");
        if (response.register.token) saveAuthToken(response.register.token);
        await refetchMe();
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(response?.register?.message ?? "Registration failed.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed.");
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordForm) => {
    try {
      await requestPasswordReset({
        variables: { email: data.email, username: data.username },
      });
      toast.success("If an account exists, a reset link will be sent to that email.");
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Request failed.");
    }
  };

  const resetForms = () => {
    loginForm.reset();
    registerForm.reset();
    forgotPasswordForm.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          resetForms();
          if (externalOpen !== undefined && onCancel) onCancel();
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to EP Games</DialogTitle>
          <DialogDescription>
            Log in or create an account to save your games and access your profile.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register" | "forgot")}>
          <TabsList className="grid w-full grid-cols-3">
            <BouncyClick>
              <TabsTrigger className="w-full text-xs sm:text-sm" value="login">
                Login
              </TabsTrigger>
            </BouncyClick>
            <BouncyClick>
              <TabsTrigger className="w-full text-xs sm:text-sm" value="register">
                Register
              </TabsTrigger>
            </BouncyClick>
            <BouncyClick>
              <TabsTrigger className="w-full text-xs sm:text-sm" value="forgot">
                Forgot Password
              </TabsTrigger>
            </BouncyClick>
          </TabsList>
          <AnimatePresence mode="wait">
            {activeTab === "login" && (
              <motion.div
                key="login"
                initial={fade_out}
                animate={normalize}
                exit={fade_out_scale_1}
                transition={transition_fast}
                className="space-y-4 my-4"
              >
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <div>
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      {...loginForm.register("username")}
                      disabled={loginForm.formState.isSubmitting}
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-destructive mt-1">
                        {loginForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      {...loginForm.register("password")}
                      disabled={loginForm.formState.isSubmitting}
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive mt-1">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <BouncyClick>
                    <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                      {loginForm.formState.isSubmitting ? (
                        <>
                          <Spinner className="mr-2" size="sm" color="white" />
                          Logging in
                        </>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </BouncyClick>
                </form>
              </motion.div>
            )}
            {activeTab === "register" && (
              <motion.div
                key="register"
                initial={fade_out}
                animate={normalize}
                exit={fade_out_scale_1}
                transition={transition_fast}
                className="space-y-4 my-4 overflow-y-auto max-h-[50vh]"
              >
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reg-username">Username *</Label>
                      <Input
                        id="reg-username"
                        {...registerForm.register("username")}
                        disabled={registerForm.formState.isSubmitting}
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="reg-displayName">Display name *</Label>
                      <Input
                        id="reg-displayName"
                        {...registerForm.register("displayName")}
                        disabled={registerForm.formState.isSubmitting}
                      />
                      {registerForm.formState.errors.displayName && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.displayName.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-email">Email *</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      {...registerForm.register("email")}
                      disabled={registerForm.formState.isSubmitting}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-destructive mt-1">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reg-password">Password *</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        {...registerForm.register("password")}
                        disabled={registerForm.formState.isSubmitting}
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="reg-confirmPassword">Confirm *</Label>
                      <Input
                        id="reg-confirmPassword"
                        type="password"
                        {...registerForm.register("confirmPassword")}
                        disabled={registerForm.formState.isSubmitting}
                      />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-bio">Bio</Label>
                    <Textarea
                      id="reg-bio"
                      {...registerForm.register("bio")}
                      disabled={registerForm.formState.isSubmitting}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-avatar">Avatar URL</Label>
                    <Input
                      id="reg-avatar"
                      {...registerForm.register("avatar")}
                      placeholder="https://..."
                      disabled={registerForm.formState.isSubmitting}
                    />
                  </div>
                  <BouncyClick>
                    <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                      {registerForm.formState.isSubmitting ? (
                        <>
                          <Spinner className="mr-2" size="sm" color="white" />
                          Creating account
                        </>
                      ) : (
                        "Register"
                      )}
                    </Button>
                  </BouncyClick>
                </form>
              </motion.div>
            )}
            {activeTab === "forgot" && (
              <motion.div
                key="forgot"
                initial={fade_out}
                animate={normalize}
                exit={fade_out_scale_1}
                transition={transition_fast}
                className="space-y-4 my-4"
              >
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-username">Username</Label>
                    <Input
                      id="forgot-username"
                      {...forgotPasswordForm.register("username")}
                      disabled={forgotPasswordForm.formState.isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      {...forgotPasswordForm.register("email")}
                      disabled={forgotPasswordForm.formState.isSubmitting}
                    />
                  </div>
                  <BouncyClick>
                    <Button type="submit" className="w-full" disabled={forgotPasswordForm.formState.isSubmitting}>
                      {forgotPasswordForm.formState.isSubmitting ? (
                        <Spinner className="mr-2" size="sm" color="white" />
                      ) : null}
                      Send reset link
                    </Button>
                  </BouncyClick>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function AuthDialog(props: AuthDialogProps) {
  return <AuthDialogContent {...props} />;
}
