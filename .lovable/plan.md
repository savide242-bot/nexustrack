

# Plano — 2 Ajustes

## 1. Barra de progresso: adicionar offset de 59.157 MT

No `RevenueProgress.tsx`, adicionar uma constante `OFFSET = 59_157` que representa as vendas do dashboard anterior. O total exibido será `OFFSET + vendas da BD`. A barra calcula percentagem sobre os 100K com este offset incluído.

**Ficheiro:** `src/components/RevenueProgress.tsx`
- `const OFFSET = 59_157;`
- `setRevenue(Math.max(0, total) + OFFSET);` (ou somar no render)

## 2. Filtro "Máximo" no DateFilter

Adicionar opção "Máximo" que define `from` como uma data muito antiga (ex: `2020-01-01`) e `to` como agora, mostrando todas as vendas de sempre.

**Ficheiro:** `src/components/DateFilter.tsx`
- Adicionar preset `all_time` com `from: new Date("2020-01-01")` e `to: endOfDay(new Date())`
- Adicionar `<SelectItem value="all_time">Máximo</SelectItem>` na lista

## Ficheiros a editar
1. `src/components/RevenueProgress.tsx`
2. `src/components/DateFilter.tsx`

