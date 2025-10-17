// src/pages/employee/Profile.tsx

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Phone, Mail, ShieldAlert, Banknote, Users, Pencil } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  // Mock data
  const [profile, setProfile] = useState({
    address: '123 Rue de la République, 75001 Paris',
    phone: '06 12 34 56 78',
    personalEmail: user?.email || 'email@personnel.com',
    emergencyContact: 'Jane Doe - 06 87 65 43 21',
    iban: 'FR76 **** **** **** **** *** 123',
  });

  const handleInputChange = (field: keyof typeof profile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    // Ici, vous appelleriez une API pour soumettre les modifications pour validation
    console.log("Demande de modification envoyée :", profile);
    setIsEditing(false);
    // Afficher un toast de succès
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mon Profil</h1>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}><Pencil className="mr-2 h-4 w-4" /> Demander une modification</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>Annuler</Button>
            <Button onClick={handleSaveChanges}>Soumettre pour validation</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations Personnelles</CardTitle>
          <CardDescription>Vos informations de contact. Les modifications sont soumises à validation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Home className="h-5 w-5 text-muted-foreground" />
            <div className="grid w-full gap-1.5">
              <Label htmlFor="address">Adresse Postale</Label>
              <Input id="address" value={profile.address} disabled={!isEditing} onChange={e => handleInputChange('address', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div className="grid w-full gap-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={profile.phone} disabled={!isEditing} onChange={e => handleInputChange('phone', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="grid w-full gap-1.5">
              <Label htmlFor="personalEmail">Email Personnel</Label>
              <Input id="personalEmail" type="email" value={profile.personalEmail} disabled={!isEditing} onChange={e => handleInputChange('personalEmail', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Banknote className="mr-2 h-5 w-5" /> Données Bancaires</CardTitle>
          </CardHeader>
          <CardContent>
            <Label>IBAN actuel</Label>
            <Input value={profile.iban} disabled />
            <p className="text-xs text-muted-foreground mt-2">Pour modifier votre IBAN, veuillez contacter le service RH avec un nouveau RIB.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ShieldAlert className="mr-2 h-5 w-5" /> Contact d'Urgence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
             <div className="grid w-full gap-1.5">
              <Label htmlFor="emergencyContact">Personne à contacter</Label>
              <Input id="emergencyContact" value={profile.emergencyContact} disabled={!isEditing} onChange={e => handleInputChange('emergencyContact', e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Famille & Ayants Droit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Pour déclarer un nouveau membre (conjoint, enfant), veuillez contacter directement le service RH.</p>
        </CardContent>
      </Card>
    </div>
  );
}