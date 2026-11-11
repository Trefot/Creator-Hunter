-- Migración 015: tamaño del icono y colores de los textos del contador en el overlay.
-- icon_scale: tamaño del icono o PNG en % (100 = el de siempre; de 50 a 300).
-- title_color y number_color: color del título y del número (en el estilo gamer, el número
-- lleva un degradado que termina en este color).
-- Solo añade columnas con valor por defecto: compatible hacia atrás.

ALTER TABLE counter ADD COLUMN icon_scale INTEGER NOT NULL DEFAULT 100 CHECK (icon_scale BETWEEN 50 AND 300);
ALTER TABLE counter ADD COLUMN title_color TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE counter ADD COLUMN number_color TEXT NOT NULL DEFAULT '#ffd34d';
