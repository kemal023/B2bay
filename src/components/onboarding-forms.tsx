"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCompany, joinCompany, type ActionResult } from "@/lib/actions/onboarding";
import { useI18n } from "@/components/i18n-provider";
import { BillingFields } from "@/components/billing-fields";

const initialState: ActionResult = { ok: true };

export function OnboardingForms() {
  const [createState, createAction, createPending] = useActionState(
    async (_: ActionResult, formData: FormData) => createCompany(formData),
    initialState,
  );
  const [joinState, joinAction, joinPending] = useActionState(
    async (_: ActionResult, formData: FormData) => joinCompany(formData),
    initialState,
  );
  const { t } = useI18n();
  const o = t.onboarding;

  return (
    <Tabs defaultValue="create" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="create">{o.newCompany}</TabsTrigger>
        <TabsTrigger value="join">{o.existingCompany}</TabsTrigger>
      </TabsList>

      <TabsContent value="create">
        <Card>
          <CardHeader>
            <CardTitle>{o.registerTitle}</CardTitle>
            <CardDescription>{o.registerDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{o.companyName}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kvkNumber">{o.kvk}</Label>
                <Input id="kvkNumber" name="kvkNumber" />
              </div>
              <BillingFields />
              <div className="space-y-2">
                <Label htmlFor="billingEmail">{o.billingEmail}</Label>
                <Input id="billingEmail" name="billingEmail" type="email" />
              </div>
              {!createState.ok && (
                <Alert variant="destructive">
                  <AlertDescription>{createState.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={createPending}>
                {createPending ? t.common.busy : o.registerSubmit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="join">
        <Card>
          <CardHeader>
            <CardTitle>{o.joinTitle}</CardTitle>
            <CardDescription>{o.joinDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={joinAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">{o.joinCode}</Label>
                <Input id="joinCode" name="joinCode" placeholder="AB3C-DEF4" required />
              </div>
              {!joinState.ok && (
                <Alert variant="destructive">
                  <AlertDescription>{joinState.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={joinPending}>
                {joinPending ? t.common.busy : o.joinSubmit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
