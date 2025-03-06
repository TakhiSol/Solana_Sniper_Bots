import readline from "readline"
import chalk from "chalk";
import fs from "fs";

import {
    title_display,
    screen_clear,
    main_menu_display,
    settings_title_display,
    settings_menu_display,
    sniper_title_display,
    sniper_menu_display,
    sniper_help_display,
    automatic_sniper_title_display,
    constants_setting_display,
    manual_sniper_title_display,
    constants_setting_title_display,
} from "./menus/menus";
import { sleep } from "./utility";
import { runListener } from "./bot";

const fileName = "./config.json"
const fileName2 = "./config_sniper.json"

// let choice = 1;

export const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

export const start = () => {
    init();
}

export const init = () => {
    let num;
    screen_clear();
    title_display();
    
    main_menu_display();

    rl.question("\t[Main] - Choice: ", (answer: string) => {
        let choice = parseInt(answer);
        if (choice == 1) {
            snipe_menu();
        }
        else if (choice == 2) {
            settings_menu();
        }
        else if (choice == 3) {
            process.exit(1);
        }
        else {
            console.log("\tInvalid choice!");
            sleep(1500);
            init();
        }
    })
}

export const snipe_menu = () => {
    screen_clear();
    sniper_title_display();
    sniper_menu_display();
    rl.question("[SniperMode]-Choice: ", (answer) => {
        let choice = parseInt(answer)
        if (choice == 1) {
            runSniper();
        }
        else if (choice == 2) {
            constantsSetting();
        }
        else if (choice == 3) {
            sniper_help_display();
            rl.question("Press Enter to go back: ", () => {
                snipe_menu()
            })
        }
        else if (choice == 4) {
            init();
        }
        else {
            console.log("\tInvalid choice!");
            sleep(1500);
            snipe_menu();
        }
    })
}

export const runSniper = async () => {
    screen_clear();
    sniper_title_display();
    // await sleep(3000)
    runListener();
}

export const constantsSetting = () => {
    screen_clear();
    constants_setting_title_display();
    constants_setting_display();
    rl.question("[Sniper Setting]-Choice: ", (answer) => {
        let choice = parseInt(answer);
        if(choice == 1) {
            rl.question('\t[Settings] - Sol Amount to Buy Token: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.solIn = Math.floor(parseFloat(answer) * 10 ** 9);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("Sol Amount is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 2) {
            rl.question('\t[Settings] - New Transaction Number: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.txNum = parseInt(answer);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("Transaction Number is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 3) {
            rl.question('\t[Settings] - Profit % to sell: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.takeProfit = parseInt(answer);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("Profit % is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 4) {
            rl.question('\t[Settings] - StopLoss % to sell: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.stopLoss = parseInt(answer);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("StopLoss % is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 5) {
            rl.question('\t[Settings] - Transaction Delay Time: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.txDelay = parseInt(answer);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("Transaction Delay Time is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 6) {
            rl.question('\t[Settings] - Transaction Fee: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.txFee = parseFloat(answer);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("Transaction Fee is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 7) {
            rl.question('\t[Settings] - Compute Unit: ', async (answer) => {
                let file_content = fs.readFileSync(fileName2, 'utf-8');
                let content = JSON.parse(file_content);
                content.computeUnit = parseInt(answer);
                fs.writeFileSync(fileName2, JSON.stringify(content, null, 2))
                console.log("Compute Unit is updated.");
                await sleep(2000);
                constantsSetting();
            });
        }
        else if(choice == 8) {
            let file_content = fs.readFileSync(fileName2, 'utf-8');
            let content = JSON.parse(file_content);
            console.log(content);
            rl.question("Press Enter to go back: ", () => {
                constantsSetting();
            })
        }
        else if(choice == 9) {
            snipe_menu();
        }
        else {
            console.log("\tInvalid choice!");
            sleep(1500);
            constantsSetting();
        }
    })
}

export const settings_menu = () => {
    screen_clear();
    settings_title_display();
    settings_menu_display();
    rl.question("[Settings]-Choice: ", (answer: string) => {
        let choice = parseInt(answer);
        if (choice == 1) {
            rl.question('\t[Settings] - New RPC Endpoint: ', async (answer) => {

                // Need to validate RPC

                let file_content = fs.readFileSync(fileName, 'utf-8');
                let content = JSON.parse(file_content);
                content.RPC_ENDPOINT = answer;
                fs.writeFileSync(fileName, JSON.stringify(content, null, 2))
                console.log("RPC_ENDPOINT is updated.");
                await sleep(2000);
                settings_menu();
            });
        }
        else if (choice == 2) {
            rl.question('\t[Settings] - New RPC_WEBSOCKET_Endpoint: ', async (answer) => {

                // Need to validate WEBSOCKET

                let file_content = fs.readFileSync(fileName, 'utf-8');
                let content = JSON.parse(file_content);
                content.RPC_WEBSOCKET_ENDPOINT = answer;
                fs.writeFileSync(fileName, JSON.stringify(content, null, 2))
                console.log("RPC_WEBSOCKET_ENDPOINT is updated.");
                await sleep(2000);
                settings_menu();
            });
        }
        else if (choice == 3) {
            rl.question('\t[Settings] - New Slippage: ', async (answer) => {
                let file_content = fs.readFileSync(fileName, 'utf-8');
                let content = JSON.parse(file_content);
                content.Slippage = parseInt(answer);
                fs.writeFileSync(fileName, JSON.stringify(content, null, 2))
                console.log("Slippage is updated.");
                await sleep(2000);
                settings_menu();
            });
        }
        else if (choice == 4) {
            rl.question('\t[Settings] - Your Wallet: ', async (answer) => {
                let file_content = fs.readFileSync(fileName, 'utf-8');
                let content = JSON.parse(file_content);
                content.PAYERPRIVATEKEY = answer;
                fs.writeFileSync(fileName, JSON.stringify(content, null, 2))
                console.log("Wallet is updated.");
                await sleep(2000);
                settings_menu();
            });
        }
        else if (choice == 5) {
            let file_content = fs.readFileSync(fileName, 'utf-8');
            let content = JSON.parse(file_content);
            console.log("Settings:");
            console.log(content);

            rl.question('\n\tpress enter to return..', () => {
                settings_menu();
            });
        }
        else if (choice == 6) {
            init();
        }
    })
}

init();