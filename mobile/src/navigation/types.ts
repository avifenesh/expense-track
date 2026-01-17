import type {
  NavigatorScreenParams,
  CompositeScreenProps,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ResetPassword: { token?: string } | undefined;
  VerifyEmail: { email: string };
};

// Onboarding Stack
export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingCurrency: undefined;
  OnboardingCategories: undefined;
  OnboardingBudget: undefined;
  OnboardingSampleData: undefined;
  OnboardingComplete: undefined;
  OnboardingBiometric: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Budgets: undefined;
  Sharing: undefined;
  Settings: undefined;
};

// App Stack (contains tabs and modals)
export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  TransactionDetail: { transactionId: string };
  EditTransaction: { transactionId: string };
  CreateTransaction: undefined;
  BudgetDetail: { budgetId: string };
  CategoryPicker: undefined;
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

// Navigation prop types for screens
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<AppStackParamList>
  >;

export type AppStackScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Declare global navigation types for useNavigation hook
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
