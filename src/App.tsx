import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { RequireAuth } from "@/app/router/guards/RequireAuth";
import { RequireWorkspaceContext } from "@/app/router/guards/RequireWorkspaceContext";
import { getAuthSessionSnapshot } from "./platform/identity-auth";
import { RouteLoadingExperience } from "./components/loading";

const LoginPage = React.lazy(() => import("./features/auth/pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const MfaVerificationPage = React.lazy(() => import("./features/auth/pages/MfaVerificationPage").then((module) => ({ default: module.MfaVerificationPage })));
const RegisterPage = React.lazy(() => import("./features/auth/pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const VerifyEmailPage = React.lazy(() => import("./features/auth/pages/VerifyEmailPage").then((module) => ({ default: module.VerifyEmailPage })));
const ForgotPasswordPage = React.lazy(() => import("./features/auth/pages/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import("./features/auth/pages/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const InvitationAcceptancePage = React.lazy(() => import("./features/auth/pages/InvitationAcceptancePage").then((module) => ({ default: module.InvitationAcceptancePage })));
const WorkspaceSelectionPage = React.lazy(() => import("./features/auth/pages/WorkspaceSelectionPage").then((module) => ({ default: module.WorkspaceSelectionPage })));
const ProtectedCrmApp = React.lazy(() => import("./ProtectedCrmApp").then((module) => ({ default: module.ProtectedCrmApp })));
const SessionExpiredPage = React.lazy(() => import("./features/auth/pages/AuthStatusPages").then((module) => ({ default: module.SessionExpiredPage })));
const AccessDeniedPage = React.lazy(() => import("./features/auth/pages/AuthStatusPages").then((module) => ({ default: module.AccessDeniedPage })));
const AccountSuspendedPage = React.lazy(() => import("./features/auth/pages/AuthStatusPages").then((module) => ({ default: module.AccountSuspendedPage })));

const RouteLoadingFallback: React.FC = () => <RouteLoadingExperience fullScreen />;

const AuthEntryRedirect: React.FC = () => (
  <Navigate to={getAuthSessionSnapshot() ? ROUTE_KEYS.WORKSPACE_SELECTION : ROUTE_KEYS.LOGIN} replace />
);

export const App: React.FC = () => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      <Route path="/" element={<AuthEntryRedirect />} />

      <Route path={ROUTE_KEYS.LOGIN} element={<LoginPage />} />
      <Route path={ROUTE_KEYS.MFA_VERIFICATION} element={<MfaVerificationPage />} />
      <Route path={ROUTE_KEYS.REGISTER} element={<RegisterPage />} />
      <Route path={ROUTE_KEYS.VERIFY_EMAIL} element={<VerifyEmailPage />} />
      <Route path={ROUTE_KEYS.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={ROUTE_KEYS.RESET_PASSWORD} element={<ResetPasswordPage />} />
      <Route path={ROUTE_KEYS.INVITATION_ACCEPTANCE} element={<InvitationAcceptancePage />} />
      <Route path={ROUTE_KEYS.SESSION_EXPIRED} element={<SessionExpiredPage />} />
      <Route path={ROUTE_KEYS.ACCESS_DENIED} element={<AccessDeniedPage />} />
      <Route path={ROUTE_KEYS.ACCOUNT_SUSPENDED} element={<AccountSuspendedPage />} />

      <Route
        path={ROUTE_KEYS.WORKSPACE_SELECTION}
        element={
          <RequireAuth>
            <WorkspaceSelectionPage />
          </RequireAuth>
        }
      />

      <Route
        path={ROUTE_KEYS.INITIAL_SETUP}
        element={
          <RequireAuth>
            <Navigate to={ROUTE_KEYS.WORKSPACE_SELECTION} replace />
          </RequireAuth>
        }
      />

      <Route
        path="*"
        element={
          <RequireAuth>
            <RequireWorkspaceContext>
              <ProtectedCrmApp />
            </RequireWorkspaceContext>
          </RequireAuth>
        }
      />
    </Routes>
  </Suspense>
);

export default App;
