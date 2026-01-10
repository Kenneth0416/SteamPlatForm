"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getAllUsers, deleteUser, updateUserRole } from "@/lib/adminStorage"
import { getTranslation } from "@/lib/translations"
import { BookOpen } from "lucide-react"
import Link from "next/link"
import type { Lang } from "@/types/lesson"
import type { StoredUser } from "@/types/auth"
import { format } from "date-fns"

export default function UsersManagement() {
  const [currentLang] = useState<Lang>("en")
  const [users, setUsers] = useState<StoredUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)

  const t = getTranslation(currentLang).admin.usersPage

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const data = await getAllUsers()
    setUsers(data)
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete)
      loadUsers()
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  const handleToggleRole = async (userId: string, currentRole: "user" | "admin") => {
    const newRole = currentRole === "admin" ? "user" : "admin"
    await updateUserRole(userId, newRole)
    loadUsers()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t.title}</h1>

      <div className="flex gap-4">
        <Input
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allRoles}</SelectItem>
            <SelectItem value="admin">{t.adminRole}</SelectItem>
            <SelectItem value="user">{t.userRole}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.name}</TableHead>
              <TableHead>{t.email}</TableHead>
              <TableHead>{t.role}</TableHead>
              <TableHead>{t.createdAt}</TableHead>
              <TableHead>{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t.noUsers}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? t.adminRole : t.userRole}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(user.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleToggleRole(user.id, user.role)}>
                        {user.role === "admin" ? t.makeUser : t.makeAdmin}
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/lessons?userId=${user.id}`}>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Lessons
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteClick(user.id)}>
                        {t.delete}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t.deleteButton}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
