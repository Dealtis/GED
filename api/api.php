
<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept");
// header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: POST, GET, PUT");




try {

  $conn = new PDO("mysql:host=127.0.0.1:3307;dbname=dealtis_ged;charset=utf8", "root" , "phiphi");
  $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
  // echo "CONNEXION GOOD";

} catch (PDOException $e) {
  echo "La Connexion a Ã©chouÃ©" . $e->getMessage();
  die();
}

if (isset($_GET["scanparheure"])) {
  $nb ="";
  $output="[";
  $add = "";
  $requete="select count(*)NB,substring(val10,1,4) from stockdoc where val2 like '".date('Ymd')."' group by substring(val10,1,4)";
  foreach  ($conn->query($requete) as $row) {
      $add = "{";
      $nb = $nb +$row["NB"];
      $add = $add."\"nbscan\": \"".$nb."\",";
      $add = $add."\"category\" : \"".$row["substring(val10,1,4)"]."0\"";
      $add = $add."},";
      $output = $output."".$add;
    }
    $output = substr($output, 0, -1);
    $output = $output."]";
    echo $output;

}
if (isset($_GET["importimg"])) {
  $requete="select count(*)NB,val5 from stockdoc where val2='".date('Ymd')."' group by val5 order by 1 desc";

$nb ="";
$nbbis ="";
$output="[";
$add = "";
  foreach  ($conn->query($requete) as $row) {
    $add = "{";
    $add = $add."\"societe\": \"".$row["val5"]."\",";
    $add = $add."\"nbimage\": \"".$row["NB"]."\",";
    $requetebis="select count(*)NB from stockdoc where val2='".date('Ymd')."' and val5='".$row["val5"]."' and val1='' order by 1 desc";
    foreach  ($conn->query($requetebis) as $item) {
        $add = $add."\"nbimagenontraite\": \"".$item["NB"]."\"";
    }
    $add = $add."},";
    $output = $output."".$add;
 }
 $output = substr($output, 0, -1);
 $output = $output."]";
 echo $output;
}

if (isset($_GET["societe"])) {
  $requete="select * from ged_societe";

  $output="[";
  $add = "";
    foreach  ($conn->query($requete) as $row) {
      $add = "{";
      $add = $add."\"societe\": \"".$row["societe_name"]."\",";
      $add = $add."\"COD_EDI\": \"".$row["societe_CODEDI"]."\",";
      $add = $add."\"NEIF\": \"".$row["societe_NEIF"]."\",";
      $add = $add."\"FTP\": \"".$row["societe_FTP"]."\"";
      $add = $add."},";
      $output = $output."".$add;
   }
   $output = substr($output, 0, -1);
   $output = $output."]";
   echo $output;
}

if (isset($_GET["erreur"])) {
  $requete="select * from ged_erreur";

  $output="[";
  $add = "";
    foreach  ($conn->query($requete) as $row) {
      $add = "{";
      $add = $add."\"filename\": \"".$row["filename"]."\",";
      $add = $add."\"zipfile\": \"".$row["zipfile"]."\",";
      $add = $add."\"societe\": \"".$row["societe"]."\",";
      $add = $add."\"errCode\": \"".$row["errCode"]."\",";
      $add = $add."\"dateerreur\": \"".$row["dateerreur"]."\"";
      $add = $add."},";
      $output = $output."".$add;
   }
   $output = substr($output, 0, -1);
   $output = $output."]";
   echo $output;
}

if($_SERVER['REQUEST_METHOD'] == 'PUT') {
      $rawInput = file_get_contents("php://input");
      $putData = json_decode($rawInput, true);
      if (is_null($putData)) {
          http_response_code(400);
          print json_encode(["message" => "Couldn't decode submission", "invalid_json_input" => $rawInput]);
      } else {
        echo $putData['type'];
        switch ($putData['type']) {
          case 'delete':
          $stmt = $conn->prepare("DELETE FROM ged_societe WHERE societe_name = :societe");
          $stmt->bindParam(':societe', $putData['societe']);
            break;
          case 'insert':
          $stmt = $conn->prepare("INSERT INTO ged_societe (societe_name, societe_CODEDI, societe_NEIF, societe_FTP) VALUES (:societe, :CODE_EDI, :NEIF, :FTP)");
          $stmt->bindParam(':societe', $putData['societe']);
          $stmt->bindParam(':CODE_EDI', $putData['CODE_EDI']);
          $stmt->bindParam(':NEIF', $putData['NEIF']);
          if ( $putData['ftp'] == "{\"host\":\"##NORETOUR\",\"port\":\"\",\"user\":\"\",\"password\":\"\"}") {
            $stmt->bindParam(':FTP', "##NORETOUR");
          }else {
            $stmt->bindParam(':FTP', substr(json_encode($putData['ftp']), 1, -1));
          }

            break;
          default:
            $stmt = $conn->prepare("UPDATE ged_societe SET societe_CODEDI = :CODE_EDI, societe_NEIF = :NEIF, societe_FTP = :FTP WHERE societe_name = :societe ");
            $stmt->bindParam(':societe', $putData['societe']);
            $stmt->bindParam(':CODE_EDI', $putData['CODE_EDI']);
            $stmt->bindParam(':NEIF', $putData['NEIF']);
            if ( $putData['ftp'] == "{\"host\":\"##NORETOUR\",\"port\":\"\",\"user\":\"\",\"password\":\"\"}") {
              $stmt->bindParam(':FTP', "##NORETOUR");
            }else {
              $stmt->bindParam(':FTP', substr(json_encode($putData['ftp']), 1, -1));
            }
            break;
        }


          $stmt->execute();
      }
}

  ?>
