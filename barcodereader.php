<?php


$fileName = $argv[1];
try {
	$Ci = new COM("ClearImage.ClearImage");

	$reader = $Ci->CreateQR();
	$reader->Image->Open($fileName);
	$BCcount = $reader->Find(0);


  if ($BCcount > 0) {
    for ($i=1;$i<=$BCcount;$i++) {
      $Bc = $reader->BarCodes($i);
      echo "$Bc->Text";
    }
  }else {

    $reader = $Ci->CreateBarcodePro();
  	$cibfCode39 = 2; $cibfCode128 = 4;
  	$reader->Type = $cibfCode39 + $cibfCode128;
  	$reader->Image->Open($fileName);
    $reader->AutoDetect1D = 65535;
    $reader->Directions = 1;
    $reader->Algorithm = 2;
  	$BCcount = $reader->Find(0);

    if ($BCcount > 0) {
      for ($i=1;$i<=$BCcount;$i++) {
    		$Bc = $reader->BarCodes($i);
    		echo "$Bc->Text";
    	}
    }else {
      $reader = $Ci->CreateBarcodePro();
    	$cibfCode39 = 2; $cibfCode128 = 4;
    	$reader->Type = $cibfCode39 + $cibfCode128;
    	$reader->Image->Open($fileName);
      $reader->AutoDetect1D = 65535;
      $reader->Directions = 2;
      $reader->Algorithm = 2;
    	$BCcount = $reader->Find(0);

      if ($BCcount > 0) {
        for ($i=1;$i<=$BCcount;$i++) {
      		$Bc = $reader->BarCodes($i);
      		echo "$Bc->Text";
      	}
      }else {
          $repair = $Ci->CreateRepair();
          $repair->Image->Open($fileName);
          // Do repair
          RepairPage($repair);
          // Save results
          $repair->Image->SaveAs($fileName);
          $reader = $Ci->CreateQR();
          $reader->Image->Open($fileName);
          $BCcount = $reader->Find(0);


          if ($BCcount > 0) {
            for ($i=1;$i<=$BCcount;$i++) {
              $Bc = $reader->BarCodes($i);
              echo "$Bc->Text";
            }
          }else {

            $reader = $Ci->CreateBarcodePro();
          	$cibfCode39 = 2; $cibfCode128 = 4;
          	$reader->Type = $cibfCode39 + $cibfCode128;
          	$reader->Image->Open($fileName);
            $reader->AutoDetect1D = 65535;
            $reader->Directions = 1;
            $reader->Algorithm = 2;
          	$BCcount = $reader->Find(0);

            if ($BCcount > 0) {
              for ($i=1;$i<=$BCcount;$i++) {
            		$Bc = $reader->BarCodes($i);
            		echo "$Bc->Text";
            	}
            }else {
              $reader = $Ci->CreateBarcodePro();
            	$cibfCode39 = 2; $cibfCode128 = 4;
            	$reader->Type = $cibfCode39 + $cibfCode128;
            	$reader->Image->Open($fileName);
              $reader->AutoDetect1D = 65535;
              $reader->Directions = 2;
              $reader->Algorithm = 2;
            	$BCcount = $reader->Find(0);

              if ($BCcount > 0) {
                for ($i=1;$i<=$BCcount;$i++) {
              		$Bc = $reader->BarCodes($i);
              		echo "$Bc->Text";
              	}
              }else {
                echo "noBarcodes";
              }
            }
        }
      }
    }

  }

} catch (Exception $e) {
  echo $e;
}

function RepairPage ($repair)
{
	$repair->AutoDeskew();
	$repair->AutoRotate();
	$repair->AutoCrop(10, 10, 10, 10);   // Crop to 10 pixels on each side to bitonal
	$repair->AdvancedBinarize(0, 0 , 0);        // Convert to bitonal an image with complex background patterns
	$ciBexBorderDeskewCrop = 3;
	$ciBeaCleaner = 2;
	$repair->BorderExtract($ciBexBorderDeskewCrop, $ciBeaCleaner); // Deskew and crop based on black border
	$repair->RemovePunchHoles();
	$ciSmoothDarkenEdges = 1;
	$repair->SmoothCharacters($ciSmoothDarkenEdges);
	$repair->CleanNoise(3);               // Clean balck noise of 3 pixels
	// $ciCnxBlackNoise = 1; $ciCnxWhiteNoise = 2;
	// $repair->CleanNoiseExt($ciCnxBlackNoise + $ciCnxWhiteNoise, 3, 3, 10, 0); // Clean black and white noise
    $ciLineVertAndHorz = 3;
	$repair->ReconstructLines($ciLineVertAndHorz);
}


 ?>
