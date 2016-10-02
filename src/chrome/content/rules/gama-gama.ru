<!--
  Mismatch on:
  (www.)
-->

<ruleset name="Gama-gama.ru">
	<target host="www.gama-gama.ru" />
	<target host="gama-gama.ru" />
	<rule from="^http://www.gama-gama\.ru/"
	to="https://gama-gama.ru" />

	<rule from="^http:" to="https:" />
</ruleset>
