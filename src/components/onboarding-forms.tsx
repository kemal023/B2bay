"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCompany, joinCompany, type ActionResult } from "@/lib/actions/onboarding";

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

  return (
    <Tabs defaultValue="create" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="create">Nieuw bedrijf</TabsTrigger>
        <TabsTrigger value="join">Bestaand bedrijf</TabsTrigger>
      </TabsList>

      <TabsContent value="create">
        <Card>
          <CardHeader>
            <CardTitle>Registreer je bedrijf</CardTitle>
            <CardDescription>
              We beoordelen elke aanvraag handmatig voordat bestellen mogelijk is.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Bedrijfsnaam</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kvkNumber">KVK-nummer</Label>
                  <Input id="kvkNumber" name="kvkNumber" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">Btw-nummer</Label>
                  <Input id="vatNumber" name="vatNumber" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Facturatie-e-mail</Label>
                <Input id="billingEmail" name="billingEmail" type="email" />
              </div>
              {!createState.ok && (
                <Alert variant="destructive">
                  <AlertDescription>{createState.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={createPending}>
                {createPending ? "Bezig..." : "Bedrijf registreren"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="join">
        <Card>
          <CardHeader>
            <CardTitle>Sluit aan bij je bedrijf</CardTitle>
            <CardDescription>
              Vraag de join-code op bij je collega die het bedrijfsaccount heeft aangemaakt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={joinAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Join-code</Label>
                <Input id="joinCode" name="joinCode" placeholder="AB3C-DEF4" required />
              </div>
              {!joinState.ok && (
                <Alert variant="destructive">
                  <AlertDescription>{joinState.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={joinPending}>
                {joinPending ? "Bezig..." : "Aansluiten"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
