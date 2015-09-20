<ruleset name="Answers">
        <target host="answers.com/" />
        <target host="www.answers.com/" />
        <target host="file*.answcdn.com/" />

        <rule from="^http:"
                to="https:" />

        <securecookie host="www\.answers\.com" name=".+" />
</ruleset>
