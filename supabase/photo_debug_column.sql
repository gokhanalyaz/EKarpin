-- Dijital Karpin - fotograf yukleme sorununu kesin teshis etmek icin
-- gecici bir debug sutunu. Her fotograf yukleme denemesinin (basarili ya
-- da basarisiz) sonucunu bu sutuna yazacagiz, boylece tek bir SQL sorgusu
-- ile ekranda uyari cikip cikmadigina bakmadan gercek durumu gorebiliriz.

alter table public.shifts add column if not exists photo_debug text;
