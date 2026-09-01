<?php
	
function Communities_0_9_6_Streams()
{
	$experienceId = "main";
	$categoryStreamType = "Streams/chats";
	$categoryStreamName = $categoryStreamType . "/" . $experienceId;
	$categoryStreamPublisherId = Q::app();

	// get or create category stream
	$categoryStream = Streams_Stream::fetch($categoryStreamPublisherId, $categoryStreamPublisherId, $categoryStreamName);
	if (empty($categoryStream)) {
		$categoryStream = Streams::create($categoryStreamPublisherId, $categoryStreamPublisherId, $categoryStreamType, array(
			"name" => $categoryStreamName,''
		));
	}

	// get all chat streams
	$chatStreams = Streams_Stream::select()
		->where(array(
			'type' => "Streams/chat"
		))
		->execute()
		->fetchAll(PDO::FETCH_ASSOC);

	foreach($chatStreams as $chatStream){
		// relate to new category
		Streams::relate(
			$categoryStream->publisherId,
			$categoryStream->publisherId,
			$categoryStream->name,
			$chatStream["type"],
			$chatStream["publisherId"],
			$chatStream["name"],
			array(
				"skipAccess" => true,
				"skipMessageTo" => true,
				"skipMessageFrom" => true
			)
		);

		echo ".";
	}
}

Communities_0_9_6_Streams();