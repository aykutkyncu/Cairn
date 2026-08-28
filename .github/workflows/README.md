# .github/workflows

CI kapıları. `ci.yml` üç iş çalıştırır:

| İş             | Kapsam                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| `quality`      | lint, prettier, `tsc --noEmit`, lint kuralı kanıtı, birim testleri + kapsam artifact'ı |
| `secrets`      | secretlint (çalışma ağacı) + gitleaks (git geçmişi)                                    |
| `dependencies` | `npm audit --audit-level=high`                                                         |

Merge engelleme **branch protection** ile kurulur; bu depo ayarını repo sahibi etkinleştirmelidir.
CI'ın yeşil olması tek başına merge'ü engellemez.
