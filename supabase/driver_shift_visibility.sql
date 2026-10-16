-- Dijital Karpin - Soforun kendi panelinde gecmis karpinleri ne kadar sure
-- gorebilecegini arac sahibi belirleyebilsin diye.

-- Arac sahibi, bir soforun kapanmis karpinlerinin KENDI panelinde (Gecmis
-- sekmesi, arac/sofor ekranlari) kac gun boyunca gorunecegini belirler.
-- NULL = sinirsiz, sofor hep gorur. Bu sadece soforun GORUNUMUNU kisitlar -
-- veri hicbir zaman silinmez; arac sahibi tarafinda (owner ekranlari) bu
-- sinir hicbir zaman uygulanmaz, tum gecmis daima gorunur.
alter table public.vehicle_drivers add column if not exists shift_visibility_days integer;
