import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { AppStackParamList } from './types'
import { MainTabNavigator } from './MainTabNavigator'
import {
  AddTransactionScreen,
  EditTransactionScreen,
  AddBudgetScreen,
  ShareExpenseScreen,
  ProfileScreen,
  AccountsScreen,
  CategoriesScreen,
} from '../screens'

const Stack = createNativeStackNavigator<AppStackParamList>()

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="CreateTransaction"
        component={AddTransactionScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="EditTransaction"
        component={EditTransactionScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="CreateBudget"
        component={AddBudgetScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="ShareExpense"
        component={ShareExpenseScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  )
}
