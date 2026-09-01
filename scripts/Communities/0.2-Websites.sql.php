<?php

function Communities_0_2_Websites_mysql()
{
	$app = Q::app();
	$communityId = Users::communityId();

	Q_Utils::cp(
		APP_WEB_DIR.DS.'img'.DS.'icon',
		APP_FILES_DIR.DS.$app.DS.'uploads'.DS.'Users'
			.DS.Q_Utils::splitId($communityId).DS.'icon'.DS.'imported'
	);

	Streams::create($communityId, $communityId, 'Websites/article', array(
		'name' => 'Communities/about',
		'readLevel' => Streams::$READ_LEVEL['messages'],
		'writeLevel' => Streams::$WRITE_LEVEL['join'],
		'inviteLevel' => Streams::$ADMIN_LEVEL['invite'],
		'article' => '',
		'userId' => $communityId
	)); // also saves Websites_Article row
}

Communities_0_2_Websites_mysql();