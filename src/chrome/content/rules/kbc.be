<ruleset name="KBC.be">
  <target host="kbc.be" />
  <target host="www.kbc.be" />
  <target host="jong.kbc.be" />
  <target host="touch.kbc.be" />
  <target host="privatebanking.kbc.be" />
  <target host="kbc-invest.kbc.be" />
  
  <!-- The site https://kbc.be gives a domain cert error. 
	   Therefore redirect it to the correct site  -->
  <rule from="^http://kbc\.be" to="https://www.kbc.be" />
  <rule from="^http:" to="https:" />
</ruleset>
