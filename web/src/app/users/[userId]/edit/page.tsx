"use client";

import { useParams, useRouter } from "next/navigation";
import { gql, useQuery, useMutation } from "@apollo/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ME_QUERY = gql`
  query MeEdit {
    me {
      id
      username
      displayName
      email
      bio
      avatar
    }
  }
`;

const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      displayName
      bio
      avatar
    }
  }
`;

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const { data } = useQuery(ME_QUERY);
  const [updateUser] = useMutation(UPDATE_USER_MUTATION);

  const me = data?.me;
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName ?? "");
      setBio(me.bio ?? "");
      setAvatar(me.avatar ?? "");
    }
  }, [me]);

  if (!data) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }
  if (!me || String(me.id) !== userId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">You can only edit your own profile.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUser({
        variables: {
          input: { displayName: displayName || null, bio: bio || null, avatar: avatar || null },
        },
      });
      toast.success("Profile updated");
      router.push(`/users/${userId}`);
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Edit profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
          />
        </div>
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
