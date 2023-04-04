<?php

$html = file_get_contents('index.html');

if (array_key_exists('src', $_REQUEST)) {
  $src = str_replace(array("\r\n", "\n", "\r"), "\\n", $_REQUEST['src']);
  $src = str_replace("'", "\\'", $src);
  $script = "window.source0 = '$src';";
  if (array_key_exists('runZeroMode', $_REQUEST)) {
    $script .= "\nwindow.runZeroMode = '{$_REQUEST['runZeroMode']}';";
  }
  if (array_key_exists('isEmbedded', $_REQUEST) && strcmp($_REQUEST['isEmbedded'], 'true') == 0) {
    $script .= "\nwindow.isEmbedded = true;";
  }

  // There are three modes in which Twoville is viewed: embedded in
  // an article, embedded in a slide, or directly as a standalone app.
  if (array_key_exists('context', $_REQUEST)) {
    $context = $_REQUEST['context'];
    if (strcmp($context, 'article') == 0 ||
        strcmp($context, 'slide') == 0 ||
        strcmp($context, 'app') == 0) {
      $script .= "\nwindow.context = '{$context}';";
    }
  }

  $html = str_replace('// SRC:PHP', $script, $html);
}

echo $html;
?>
